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
class hdp-spark(
  $type,
  $service_state) 
{
  include hdp-spark::params
 
  $spark_user = $hdp-spark::params::spark_user
  $config_dir = $hdp-spark::params::conf_dir
  
  $hdp::params::component_exists['hdp-spark'] = true
  $smokeuser = $hdp::params::smokeuser

  anchor{'hdp-spark::begin':}
  anchor{'hdp-spark::end':}

  if ($service_state == 'uninstalled') {
    hdp::package { 'spark':
      ensure => 'uninstalled'
    }
    hdp::directory { $config_dir:
      service_state => $service_state,
      force => true
    }

    Anchor['hdp-spark::begin'] -> Hdp::Package['spark'] -> Hdp::Directory[$config_dir] -> Anchor['hdp-spark::end']

  } else {  
    hdp::package { 'spark': }
  
    hdp::directory { $config_dir: 
      service_state => $service_state,
      force => true,
      owner => $spark_user,
      group => $hdp::params::user_group,
      override_owner => true
    }

   hdp-spark::configfile { ['spark-env.sh','hadoop-metrics.properties']: 
      type => $type
    }

    hdp-spark::configfile { 'spark-workers':}

    Anchor['hdp-spark::begin'] -> Hdp::Package['spark'] -> Hdp::Directory[$config_dir] -> 
    Hdp-spark::Configfile<||> ->  Anchor['hdp-spark::end']
  }
}

### config files
define hdp-spark::configfile(
  $mode = undef,
  $spark_server_host = undef,
  $template_tag = undef,
  $type = undef,
  $conf_dir = $hdp-spark::params::conf_dir
) 
{
  if ($name == 'hadoop-metrics.properties') {
    if ($type == 'server') {
      $tag = GANGLIA-MASTER
    } else {
      $tag = GANGLIA-RS
    }
  } else {
    $tag = $template_tag
  }

  hdp::configfile { "${conf_dir}/${name}":
    component         => 'spark',
    owner             => $hdp-spark::params::spark_user,
    mode              => $mode,
    spark_server_host => $spark_server_host,
    template_tag      => $tag
  }
}
