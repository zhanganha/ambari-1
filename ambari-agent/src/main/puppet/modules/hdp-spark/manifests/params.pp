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
class hdp-spark::params() inherits hdp::params
{
  ####### users
  $spark_user = $hdp::params::spark_user
  
  ### spark-env
  $hadoop_conf_dir = hdp_default("hadoop_conf_dir")
  $conf_dir = $hdp::params::spark_conf_dir

  $spark_log_dir = hdp_default("spark_log_dir","/var/log/spark")

  $spark_server_heapsize = hdp_default("spark_server_heapsize","1000m")

  $spark_pid_dir = hdp_default("spark_pid_dir","/var/run/spark")

  $spark_worker_heapsize = hdp_default("spark_worker_heapsize","1000m")

  $spark_worker_xmn_size = hdp_calc_xmn_from_xms("$spark_worker_heapsize","0.2","512")

}
