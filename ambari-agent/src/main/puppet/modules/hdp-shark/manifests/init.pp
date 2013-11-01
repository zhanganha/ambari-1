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
class hdp-shark(
  $type,
  $service_state) 
{
  include hdp-shark::params
 
  $shark_user = $hdp-shark::params::shark_user
  $config_dir = $hdp-shark::params::conf_dir
  $install_dir = "/usr/lib/shark"
  
  $hdp::params::component_exists['hdp-shark'] = true
  $smokeuser = $hdp::params::smokeuser

  anchor{'hdp-shark::begin':}
  anchor{'hdp-shark::end':}

  if ($service_state == 'uninstalled') {
#    hdp::package { 'shark':
#      ensure => 'uninstalled'
#    }

    exec { 'package-shark' :
       onlyif => "/bin/ls $install_dir",
       command => "/bin/rm -rf /usr/lib/shark && /bin/rm -rf /usr/lib/hive-shark"
    }      

    exec { 'package-scala-dep' :
       onlyif => "/bin/ls /usr/lib/scala",
       command => "/bin/rm -rf /usr/lib/scala"
    }      


#    hdp::directory { $config_dir:
#      service_state => $service_state,
#      force => true
#    }

    Anchor['hdp-shark::begin'] -> Exec['package-shark'] -> Exec['package-scala-dep'] -> 
    #Hdp::Directory[$config_dir] -> 
    Anchor['hdp-shark::end']

  } else {  
#    hdp::package { 'shark': }

    exec { 'package-scala-dep' :
        unless => "/bin/ls /usr/lib/scala",
	command => "/usr/bin/curl -o /tmp/scala.tgz http://www.scala-lang.org/files/archive/scala-2.9.3.tgz && tar -xzf /tmp/scala.tgz -C /usr/lib && mv /usr/lib/scala-2.9.3 /usr/lib/scala && rm -rf /tmp/scala.tgz"
    }
    
    exec { 'package-shark' :
        unless => "/bin/ls $install_dir",
	command => "/usr/bin/curl -o /tmp/shark.tgz https://s3.amazonaws.com/nflabs/NFL/centos6/1.x/updates/1.3.2.0/shark/shark-0.8.0-bin-hadoop1.tgz && tar -xzf /tmp/shark.tgz -C /usr/lib && mv /usr/lib/shark-0.8.0-bin-hadoop1/shark-0.8.0 /usr/lib/shark && mv /usr/lib/shark-0.8.0-bin-hadoop1/hive-0.9.0-shark-0.8.0-bin /usr/lib/hive-shark && rm -rf /usr/lib/shark-0.8.0-bin-hadoop1 && rm -rf /tmp/shark.tgz",
    }
  
#    hdp::directory { $config_dir: 
#      service_state => $service_state,
#      force => true,
#      owner => $shark_user,
#      group => $hdp::params::user_group,
#      override_owner => true
#    }

    hdp-shark::configfile { 'shark-env.sh' : conf_dir => $config_dir}

    Anchor['hdp-shark::begin'] -> Exec['package-scala-dep'] ->Exec['package-shark'] -> 
    # Hdp::Directory[$config_dir] -> 
    Hdp-shark::Configfile<||> ->  Anchor['hdp-shark::end']
  }
}

### config files
define hdp-shark::configfile(
  $mode = undef,
#  $shark_server_host = undef,
  $template_tag = undef,
  $type = undef,
  $conf_dir = $hdp-shark::params::conf_dir
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
    component         => 'shark',
    owner             => $hdp-shark::params::shark_user,
    mode              => $mode,
#    shark_server_host => $shark_server_host,
    template_tag      => $tag
  }
}
