#!/usr/bin/env python
"""
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

"""

from resource_management import *
import status_params

# server configurations
config = Script.get_config()

hostname = config['hostname']
user_group = config['configurations']['global']['user_group']
spark_user = config['configurations']['global']['spark_user']
  
### spark-env
hadoop_conf_dir = "/etc/hadoop/conf"
config_dir = "/etc/spark/conf"
spark_bin = '/usr/lib/spark/sbin'

spark_log_dir = config['configurations']['global']['spark_log_dir']

spark_log_file = 'spark.log'

spark_pid_dir = status_params.pid_dir

spark_master_port = config['configurations']['spark-site']['SPARK_MASTER_PORT']

spark_master_webui_port = config['configurations']['spark-site']['SPARK_MASTER_WEBUI_PORT']

java64_home = config['hostLevelParams']['java_home']

spark_master_hosts = config['clusterHostInfo']['spark_server_hosts'][0]
spark_master_hosts.sort()

spark_worker_hosts = config['clusterHostInfo']['spark_worker_hosts']
spark_worker_hosts.sort()

log4j_file = format("{config_dir}/log4j.properties")
slaves_file = format("{config_dir}/slave")
spark_env_file = format("{config_dir}/spark_env.sh")

is_spark_master = hostname in spark_master_hosts

if 'ganglia_server_host' in config['clusterHostInfo'] and \
    len(config['clusterHostInfo']['ganglia_server_host'])>0:
  ganglia_installed = True
  ganglia_server = config['clusterHostInfo']['ganglia_server_host'][0]
  ganglia_report_interval = 60
else:
  ganglia_installed = False

