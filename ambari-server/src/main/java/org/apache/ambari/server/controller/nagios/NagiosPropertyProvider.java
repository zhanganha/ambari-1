/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.ambari.server.controller.nagios;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;

import org.apache.ambari.server.AmbariException;
import org.apache.ambari.server.configuration.ComponentSSLConfiguration;
import org.apache.ambari.server.controller.internal.BaseProvider;
import org.apache.ambari.server.controller.spi.Predicate;
import org.apache.ambari.server.controller.spi.PropertyProvider;
import org.apache.ambari.server.controller.spi.Request;
import org.apache.ambari.server.controller.spi.Resource;
import org.apache.ambari.server.controller.spi.SystemException;
import org.apache.ambari.server.controller.utilities.StreamProvider;
import org.apache.ambari.server.state.Cluster;
import org.apache.ambari.server.state.Clusters;
import org.apache.ambari.server.state.Service;
import org.apache.ambari.server.state.ServiceComponentHost;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;
import com.google.inject.Inject;
import com.google.inject.Injector;

/**
 * Used to populate resources that have Nagios alertable properties.
 */
public class NagiosPropertyProvider extends BaseProvider implements PropertyProvider {
  
  private static final Logger LOG = LoggerFactory.getLogger(NagiosPropertyProvider.class);
  private static final Set<String> NAGIOS_PROPERTY_IDS = new HashSet<String>();
  private static final String NAGIOS_TEMPLATE = "http://%s/ambarinagios/nagios/nagios_alerts.php?q1=alerts&alert_type=all";
  
  private static final String ALERT_DETAIL_PROPERTY_ID = "alerts/detail";
  private static final String ALERT_SUMMARY_OK_PROPERTY_ID = "alerts/summary/OK";
  private static final String ALERT_SUMMARY_WARNING_PROPERTY_ID = "alerts/summary/WARNING";
  private static final String ALERT_SUMMARY_CRITICAL_PROPERTY_ID = "alerts/summary/CRITICAL";
  
  
  // holds alerts for clusters.  clusterName -> AlertStates
  private static final Map<String, AlertState> CLUSTER_ALERTS = new ConcurrentHashMap<String, AlertState>();
  private static final ScheduledExecutorService scheduler;
  
  static {
    NAGIOS_PROPERTY_IDS.add("alerts/summary");
    NAGIOS_PROPERTY_IDS.add("alerts/detail");

    scheduler = Executors.newSingleThreadScheduledExecutor(new ThreadFactory() {
      @Override
      public Thread newThread(Runnable r) {
        return new Thread(r, "NagiosPropertyProvider Request Reset Thread");
      }
    });
    
    scheduler.scheduleAtFixedRate(new Runnable() {
      @Override
      public void run() {
        for (AlertState alertState : CLUSTER_ALERTS.values())
          alertState.isReloadNeeded().set(true);
      }
    }, 0L, 20L, TimeUnit.SECONDS);
  }

  @Inject
  private static Clusters clusters;
  private Resource.Type resourceType;
  private String clusterNameProperty;
  private String resourceTypeProperty;
  private StreamProvider urlStreamProvider;
  
  
  @Inject
  public static void init(Injector injector) {
    clusters = injector.getInstance(Clusters.class);
  }  
  
  public NagiosPropertyProvider(Resource.Type type,
      StreamProvider streamProvider,
      String clusterPropertyId,
      String typeMatchPropertyId) {
    
    super(NAGIOS_PROPERTY_IDS);
    
    resourceType = type;
    clusterNameProperty = clusterPropertyId;
    resourceTypeProperty = typeMatchPropertyId;
    urlStreamProvider = streamProvider;
  }
  
  /**
   * Use only for testing to remove all cached alerts.
   */
  public void forceReset() {
    CLUSTER_ALERTS.clear();
  }
  
  @Override
  public Set<Resource> populateResources(Set<Resource> resources,
      Request request, Predicate predicate) throws SystemException {

    Set<String> propertyIds = getRequestPropertyIds(request, predicate);
    
    
    for (Resource res : resources) {
      String matchValue = res.getPropertyValue(resourceTypeProperty).toString();
      
      if (null == matchValue)
        continue;
      
      String clusterName = res.getPropertyValue(clusterNameProperty).toString();
      if (null == clusterName)
        continue;
      
      if (!CLUSTER_ALERTS.containsKey(clusterName)) {
        CLUSTER_ALERTS.put(clusterName, new AlertState (populateAlerts(clusterName)));
      } else if (CLUSTER_ALERTS.get(clusterName).isReloadNeeded().get()) {
        LOG.debug("Alerts are stale for cluster " + clusterName);
        CLUSTER_ALERTS.get(clusterName).setAlerts(populateAlerts(clusterName));
        CLUSTER_ALERTS.get(clusterName).isReloadNeeded().set(false);
      }
      
      updateAlerts(res, matchValue, CLUSTER_ALERTS.get(clusterName).getAlerts(), propertyIds);
    }
    
    return resources;
  }
  
  /**
   * Aggregates and sets nagios properties on a resource.
   * @param res the resource
   * @param matchValue the value to match
   * @param allAlerts all alerts from Nagios
   * @param requestedIds the requested ids for the resource
   */
  private void updateAlerts(Resource res, String matchValue, List<NagiosAlert> allAlerts,
      Set<String> requestedIds) {
    if (null == allAlerts || 0 == allAlerts.size())
      return;
    
    int ok = 0;
    int warning = 0;
    int critical = 0;
    
    List<Map<String, Object>> alerts = new ArrayList<Map<String, Object>>();
    
    for (NagiosAlert alert : allAlerts) {
      boolean match = false;
      
      switch (resourceType) {
        case Service:
          match = alert.getService().equals(matchValue);
          break;
        case Host:
          match = alert.getHost().equals(matchValue);
          break;
        default:
          break;
      }
      
      if (match) {
        switch (alert.getStatus()) {
          case 0:
            ok++;
            break;
          case 1:
            warning++;
            break;
          case 2:
            critical++;
            break;
          default:
            break;
        }
        
        Map<String, Object> map = new LinkedHashMap<String, Object>();

        map.put("description", alert.getDescription());
        map.put("host_name", alert.getHost());
        map.put("last_status", NagiosAlert.getStatusString(alert.getLastStatus()));
        map.put("last_status_time", Long.valueOf(alert.getLastStatusTime()));
        map.put("service_name", alert.getService());
        map.put("status", NagiosAlert.getStatusString(alert.getStatus()));
        map.put("status_time", Long.valueOf(alert.getStatusTime()));
        map.put("output", alert.getOutput());
        
        alerts.add(map);
      }
    }
    
    setResourceProperty(res, ALERT_SUMMARY_OK_PROPERTY_ID, Integer.valueOf(ok), requestedIds);
    setResourceProperty(res, ALERT_SUMMARY_WARNING_PROPERTY_ID, Integer.valueOf(warning), requestedIds);
    setResourceProperty(res, ALERT_SUMMARY_CRITICAL_PROPERTY_ID, Integer.valueOf(critical), requestedIds);
    
    if (!alerts.isEmpty())
      setResourceProperty(res, ALERT_DETAIL_PROPERTY_ID, alerts, requestedIds);
  }

  /**
   * Contacts Nagios and loads/parses the response into Nagios alert instances.
   * @param clusterName the cluster name
   * @return a list of nagios alerts
   * @throws SystemException
   */
  private List<NagiosAlert> populateAlerts(String clusterName) throws SystemException {
    
    String nagiosHost = null;
    
    try {
      Cluster cluster = clusters.getCluster(clusterName);
      Service service = cluster.getService("NAGIOS");
      Map<String, ServiceComponentHost> hosts = service.getServiceComponent("NAGIOS_SERVER").getServiceComponentHosts();
      
      if (!hosts.isEmpty())
        nagiosHost = hosts.keySet().iterator().next();
      
    } catch (AmbariException e) {
      LOG.error("Cannot find a nagios service.  Skipping alerts.");
    }
    
    if (null != nagiosHost) {
      String template = NAGIOS_TEMPLATE;

      if (ComponentSSLConfiguration.instance().isNagiosSSL())
        template = template.replace("http", "https");
      
      String url = String.format(template, nagiosHost);  

      InputStream in = null;
      try {
        in = urlStreamProvider.readFrom(url);
        
        NagiosAlerts alerts = new Gson().fromJson(IOUtils.toString(in, "UTF-8"), NagiosAlerts.class);
        
        Collections.sort(alerts.alerts, new Comparator<NagiosAlert>() {
          @Override
          public int compare(NagiosAlert o1, NagiosAlert o2) {
            return o2.getStatus()-o1.getStatus();
          }
        });
        
        return alerts.alerts;
      } catch (IOException ioe) {
        LOG.error("Error reading HTTP response from " + url);
      } catch (JsonSyntaxException jse) {
        LOG.error("Error parsing HTTP response from " + url);
      } finally {
        if (in != null) {
          try {
            in.close();
          }
          catch (IOException ioe) {
            LOG.error("Error closing HTTP response stream " + url);
          }
        }
      }      
    }
    
    return new ArrayList<NagiosAlert>();
  }
  
  private static class NagiosAlerts {
    private List<NagiosAlert> alerts;
  }

}