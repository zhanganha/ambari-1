#
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
#
class hdp-spark::server(
  $service_state = $hdp::params::cluster_service_state,
  $opts = {}
) inherits hdp-spark::params 
{

  if ($service_state == 'no_op') {
  } elsif ($service_state in ['running','stopped','installed_and_configured','uninstalled']) {    
    $hdp::params::service_exists['hdp-spark::server'] = true

    #adds package, users, directories, and common configs
    class { 'hdp-spark':
      type          => 'server',
      service_state => $service_state
    }

    #Hdp-spark::Configfile<||>{spark_server_hosts => $hdp::params::host_address}

    hdp-spark::service{ 'master':
      ensure => $service_state
    }

    #top level does not need anchors
    Class['hdp-spark'] -> Hdp-spark::Service['master'] 
    } else {
    hdp_fail("TODO not implemented yet: service_state = ${service_state}")
  }
}

