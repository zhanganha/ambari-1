#!/bin/bash
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
##################################################
# Script to define, install and start SPARK service
# after Ambari installer finishes.
#
# Spark service is defined, installed and started 
# via API calls.
##################################################

if (($# != 4)); then
  echo "Usage: $0: <AMBARI_HOST> <SPARK_HOST> <COMPONENT: SPARK_SERVER or SPARK_WORKER> <CLUSTER_NAME>";
  exit 1;
fi

AMBARIURL="http://$1:8080"
USERID="admin"
PASSWD="admin"

defineService () {
  if curl -s -u $USERID:$PASSWD "$AMBARIURL/api/v1/clusters/$1/services" | grep service_name | cut -d : -f 2 | grep -q SPARK ; then
    echo "SPARK service already defined.";
  else
    echo "Defining SPARK";
    curl -u $USERID:$PASSWD -X POST "$AMBARIURL/api/v1/clusters/$1/services" --data "[{\"ServiceInfo\":{\"service_name\":\"SPARK\"}}]";
  fi
}

defineServiceComponent () {
  if curl -s -u $USERID:$PASSWD "$AMBARIURL/api/v1/clusters/$1/services/SPARK" | grep components | cut -d : -f 2 | grep -q "\[ \]" ; then
    echo "Defining $2 service component"
    curl -u $USERID:$PASSWD -X POST "$AMBARIURL/api/v1/clusters/$1/services?ServiceInfo/service_name=SPARK" --data "{\"components\":[{\"ServiceComponentInfo\":{\"component_name\":\"$2\"}}]}";
  else
    echo "$2 service component already defined."
  fi
}

defineHostComponent () {
  if ! curl -s -u $USERID:$PASSWD "$AMBARIURL/api/v1/clusters/$2/hosts/$1" | grep component_name | cut -d : -f 2 | grep -q "SPARK_SERVER" ; then
    echo "Defining $3 host component on $1"
    curl -u $USERID:$PASSWD -X POST "$AMBARIURL/api/v1/clusters/$2/hosts?Hosts/host_name=$1" --data "{\"host_components\":[{\"HostRoles\":{\"component_name\":\"$3\"}}]}";
  else
    echo "$3 host component already defined on $1."
  fi
}

installService () {
  if curl -s -u $USERID:$PASSWD "$AMBARIURL/api/v1/clusters/$1/services/SPARK" | grep state | cut -d : -f 2 | grep -q "INIT" ; then
    echo "Installing $2 service"
    curl -u $USERID:$PASSWD -X PUT "$AMBARIURL/api/v1/clusters/$1/services?ServiceInfo/state=INIT&ServiceInfo/service_name=SPARK" --data "{\"RequestInfo\": {\"context\" :\"Install SPARK Service\"}, \"Body\": {\"ServiceInfo\": {\"state\": \"INSTALLED\"}}}";
  else
    echo "$2 already installed."
  fi
}

startService () {
  if curl -s -u $USERID:$PASSWD "$AMBARIURL/api/v1/clusters/$1/services/SPARK" | grep state | cut -d : -f 2 | grep -q "STARTED" ; then
    echo "$2 already started."
  else
    echo "Starting $2 service"
    curl -u $USERID:$PASSWD -X PUT "$AMBARIURL/api/v1/clusters/$1/services?ServiceInfo/state=INSTALLED&ServiceInfo/service_name=SPARK" --data "{\"RequestInfo\": {\"context\" :\"Start SPARK Service\"}, \"Body\": {\"ServiceInfo\": {\"state\": \"STARTED\"}}}";
  fi
}


defineService $4
defineServiceComponent  $4 $3
defineHostComponent $2 $4 $3
installService $4 $3
startService $4 $3
