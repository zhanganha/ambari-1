/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with this
 * work for additional information regarding copyright ownership. The ASF
 * licenses this file to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var App = require('app');

App.MainDashboardServiceSparkView = App.MainDashboardServiceView.extend({
  templateName: require('templates/main/dashboard/service/spark'),
  serviceName: 'spark',
  
/*  summaryHeader: function () {
    var count = this.get('service.nodes.length');
    if(count==1)
      return this.t("dashboard.services.flume.summary.single").format(count);
    return this.t("dashboard.services.flume.summary.multiple").format(count);
  }.property('service.nodes'),
*/

  liveWorkerNodes: function () {
    return App.HostComponent.find().filterProperty('componentName', 'SPARK_WORKER').filterProperty("workStatus","STARTED");
  }.property(),
  

  workerNodesText: function () {
    if(this.get('service.workerNodes').get("length") > 1) {
      return Em.I18n.t('services.service.summary.viewHosts');
    }else{
      return Em.I18n.t('services.service.summary.viewHost');
    }
  }.property("service"),

  sparkWorkerComponent: function () {
    return App.HostComponent.find().findProperty('componentName', 'SPARK_WORKER');
  }.property(),


  sparkServerComponent: function () {
    return App.HostComponent.find().findProperty('componentName', 'SPARK_SERVER'); 
  }.property(),

/*  sparkServerWebUrl: function () {
    if (this.get('activeMaster.host') && this.get('activeMaster.host').get('publicHostName')) {
      return "http://" + (App.singleNodeInstall ? App.singleNodeAlias : this.get('activeMaster.host').get('publicHostName')) + ":60010";
    }
  }.property('activeMaster'),
*/

});
