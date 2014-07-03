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

  anchor{'hdp-spark::begin':}
  anchor{'hdp-spark::end':}
  
  if ($service_state == 'no_op') {
  } elsif ($service_state == 'uninstalled') {
    hdp::package { 'spark' :
      ensure => 'uninstalled',
      size   => $size
    }
    hdp::directory_recursive_create { $config_dir:
      service_state => $service_state,
      force => true
    }
   anchor { 'hdp-spark::begin': } -> Hdp::Package['spark'] -> Hdp::Directory_recursive_create[$config_dir] -> anchor { 'hdp-spark::end': }

  } elsif ($service_state in ['running','stopped','installed_and_configured','uninstalled']) { 
    hdp::package { 'spark': }
  
  	hdp::user{ 'spark_user':
      user_name => $spark_user
    }
  
    hdp::directory { $config_dir: 
      service_state => $service_state,
      force => true,
      owner => $spark_user,
      group => $hdp::params::user_group,
      override_owner => true
    }

	if ($service_state == 'installed_and_configured') {
	    hdp::directory { $hdp::params::spark_bin: 
	      service_state => $service_state,
	      force => true
	    }
        hdp-spark::shell_file{ 'sparkService.sh': }
    }
    hdp-spark::configfile { 'spark-env.sh' : conf_dir => $config_dir}

    hdp-spark::configfile { 'slaves' : conf_dir => $config_dir}

    Anchor['hdp-spark::begin'] -> Hdp::Package['spark'] -> Hdp::Directory[$config_dir] -> 
    Hdp-spark::Configfile<||> ->  Anchor['hdp-spark::end']
  } else {
    hdp_fail("TODO not implemented yet: service_state = ${service_state}")
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
  hdp::configfile { "${conf_dir}/${name}":
    component         => 'spark',
    owner             => $hdp-spark::params::spark_user,
    mode              => $mode,
    spark_server_host => $spark_server_host,
    template_tag      => $tag
  }
}

### 
define hdp-spark::shell_file()
{
  file { "${hdp::params::spark_bin}/${name}":
    source => "puppet:///modules/hdp-spark/${name}", 
    mode => '0755'
  }
}
