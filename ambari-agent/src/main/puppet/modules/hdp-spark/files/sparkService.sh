#!/bin/sh
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

spark_bin=$1
service=$2
ensure=$3
spark_pid_dir=$4

case "$service" in

master) 
    if [[ ${ensure} == 'running' ]]; then 
      ${spark_bin}/start-all.sh
 	  ln ${spark_pid_dir}/spark-*master*.pid ${spark_pid_dir}/spark-master.pid
 	else 
 	  ${spark_bin}/stop-all.sh
 	fi
    ;;
worker) 
#    if [[ ${ensure} == 'running' ]]; then 
#      ${spark_bin}/start-slave.sh 
# 	else 
#	  ${spark_bin}/stop-slave.sh
# 	fi
    ;;
*) echo "UNKNOWN: Invalid service name [$service]"
   exit 3
   ;;
esac
