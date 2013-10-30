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
define hdp-spark::service(
  $ensure = 'running',
)
{
  include hdp-spark::params

  $role = $name

  if ($ensure == 'running') {
    $daemon_cmd = "su - ${user} -c  '${cmd} start ${role}'"
    $no_op_test = "ls ${pid_file} >/dev/null 2>&1 && ps `cat ${pid_file}` >/dev/null 2>&1"
  } elsif ($ensure == 'stopped') {
    $daemon_cmd = "su - ${user} -c  '${cmd} stop ${role}'"
    $no_op_test = undef
  } else {
    $daemon_cmd = undef
  }


    # service spark-master start
    if ($ensure in [ 'running', 'stopped' ]){
        service { "spark-${role}" :
            ensure => $ensure
        }
    }
}
