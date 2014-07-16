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

import os

from resource_management import *
import sys


def spark(type = None):
  import params

  Directory(params.config_dir,
            owner=params.spark_user,
            recursive=True,
            group=params.user_group
  )

  #configFile("log4j.properties", template_name="log4j.properties.j2")
  
  if params.ganglia_installed
  	configFile("slaves", template_name="metrics.properties.j2")
  
  configFile("slaves", template_name="slaves.j2")
  configFile("spark-env.sh", template_name="spark-env.sh.j2")

  Directory(params.spark_pid_dir,
            owner=params.spark_user,
            recursive=True,
            group=params.user_group
  )

  Directory(params.spark_log_dir,
            owner=params.spark_user,
            recursive=True,
            group=params.user_group
  )


def configFile(name, template_name=None):
  import params

  File(format("{config_dir}/{name}"),
       content=Template(template_name),
       owner=params.spark_user,
       group=params.user_group
  )




