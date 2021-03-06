#!/usr/bin/env python

'''
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
'''

import os
import glob
import logging
import pwd
import re
import time
import subprocess
import threading
import shlex
import platform
from PackagesAnalyzer import PackagesAnalyzer
from HostCheckReportFileHandler import HostCheckReportFileHandler
from Hardware import Hardware
from common_functions import OSCheck

logger = logging.getLogger()

# OS info
OS_VERSION = OSCheck().get_os_major_version()
OS_TYPE = OSCheck.get_os_type()
OS_FAMILY = OSCheck.get_os_family()

# OS constants
OS_UBUNTU_DEBIAN = 'debian'
OS_UBUNTU = 'ubuntu'
OS_FEDORA = 'fedora'
OS_OPENSUSE = 'opensuse'
OS_SUSE = 'suse'
OS_SUSE_ENTERPRISE = 'sles'

# service cmd
SERVICE_CMD = "/sbin/service"

# on ubuntu iptables service is called ufw
if OS_FAMILY == OS_UBUNTU_DEBIAN:
  SERVICE_CMD = "/usr/sbin/service"

class HostInfo:
  # List of project names to be used to find alternatives folders etc.
  DEFAULT_PROJECT_NAMES = [
    "hadoop*", "hadoop", "hbase", "hcatalog", "hive", "ganglia", "nagios",
    "oozie", "sqoop", "hue", "zookeeper", "mapred", "hdfs", "flume",
    "storm", "hive-hcatalog", "tez", "falcon", "ambari_qa", "hadoop_deploy",
    "rrdcached", "hcat", "ambari-qa", "sqoop-ambari-qa", "sqoop-ambari_qa",
    "webhcat", "hadoop-hdfs", "hadoop-yarn", "hadoop-mapreduce"
  ]

  # List of live services checked for on the host, takes a map of plan strings
  DEFAULT_LIVE_SERVICES = [
    {"redhat":"ntpd", "suse":"ntp", "debian":"ntp"}
  ]

  # Set of default users (need to be replaced with the configured user names)
  DEFAULT_USERS = [
    "nagios", "hive", "ambari-qa", "oozie", "hbase", "hcat", "mapred",
    "hdfs", "rrdcached", "zookeeper", "flume", "sqoop", "sqoop2",
    "hue", "yarn"
  ]

  # Filters used to identify processed
  PROC_FILTER = [
    "hadoop", "zookeeper"
  ]

  # Additional path patterns to find existing directory
  DIRNAME_PATTERNS = [
    "/tmp/hadoop-", "/tmp/hsperfdata_"
  ]

  # Default set of directories that are checked for existence of files and folders
  DEFAULT_DIRS = [
    "/etc", "/var/run", "/var/log", "/usr/lib", "/var/lib", "/var/tmp", "/tmp", "/var", "/hadoop"
  ]

  # Packages that are used to find repos (then repos are used to find other packages)
  PACKAGES = [
    "hadoop", "zookeeper", "webhcat", "*-manager-server-db", "*-manager-daemons"
  ]

  # Additional packages to look for (search packages that start with these)
  ADDITIONAL_PACKAGES = [
    "rrdtool", "rrdtool-python", "nagios", "ganglia", "gmond", "gweb", "libconfuse", "ambari-log4j",
    "hadoop", "zookeeper", "oozie", "webhcat"
  ]

  # ignore packages from repos whose names start with these strings
  IGNORE_PACKAGES_FROM_REPOS = [
    "ambari", "installed"
  ]

  # ignore required packages
  IGNORE_PACKAGES = [
    "epel-release"
  ]

  # ignore repos from the list of repos to be cleaned
  IGNORE_REPOS = [
    "ambari", "HDP-UTILS"
  ]

  # default timeout for async invoked processes
  TIMEOUT_SECONDS = 60
  RESULT_UNAVAILABLE = "unable_to_determine"
  
  DEFAULT_SERVICE_NAME = "ntpd"
  SERVICE_STATUS_CMD = "%s %s status" % (SERVICE_CMD, DEFAULT_SERVICE_NAME)
  
  event = threading.Event()
  
  current_umask = -1

  def __init__(self, config=None):
    self.packages = PackagesAnalyzer()
    self.reportFileHandler = HostCheckReportFileHandler(config)


  def dirType(self, path):
    if not os.path.exists(path):
      return 'not_exist'
    elif os.path.islink(path):
      return 'sym_link'
    elif os.path.isdir(path):
      return 'directory'
    elif os.path.isfile(path):
      return 'file'
    return 'unknown'

  def hadoopVarRunCount(self):
    if not os.path.exists('/var/run/hadoop'):
      return 0
    pids = glob.glob('/var/run/hadoop/*/*.pid')
    return len(pids)

  def hadoopVarLogCount(self):
    if not os.path.exists('/var/log/hadoop'):
      return 0
    logs = glob.glob('/var/log/hadoop/*/*.log')
    return len(logs)

  def etcAlternativesConf(self, projects, etcResults):
    if not os.path.exists('/etc/alternatives'):
      return []
    projectRegex = "'" + '|'.join(projects) + "'"
    files = [f for f in os.listdir('/etc/alternatives') if re.match(projectRegex, f)]
    for conf in files:
      result = {}
      filePath = os.path.join('/etc/alternatives', conf)
      if os.path.islink(filePath):
        realConf = os.path.realpath(filePath)
        result['name'] = conf
        result['target'] = realConf
        etcResults.append(result)

  def checkLiveServices(self, services, result):
    osType = OSCheck.get_os_family()
    for service in services:
      svcCheckResult = {}
      if isinstance(service, dict):
        serviceName = service[osType]
      else:
        serviceName = service
      
      service_check_live = shlex.split(self.SERVICE_STATUS_CMD)
      service_check_live[1] = serviceName
      
      svcCheckResult['name'] = serviceName
      svcCheckResult['status'] = "UNKNOWN"
      svcCheckResult['desc'] = ""
      try:
        osStat = subprocess.Popen(service_check_live, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE)
        out, err = osStat.communicate()
        if 0 != osStat.returncode:
          svcCheckResult['status'] = "Unhealthy"
          svcCheckResult['desc'] = out
          if len(out) == 0:
            svcCheckResult['desc'] = err
        else:
          svcCheckResult['status'] = "Healthy"
      except Exception, e:
        svcCheckResult['status'] = "Unhealthy"
        svcCheckResult['desc'] = repr(e)
      result.append(svcCheckResult)

  def checkUsers(self, users, results):
    f = open('/etc/passwd', 'r')
    for userLine in f:
      fields = userLine.split(":")
      if fields[0] in users:
        result = {}
        homeDir = fields[5]
        result['name'] = fields[0]
        result['homeDir'] = fields[5]
        result['status'] = "Available";
        if not os.path.exists(homeDir):
          result['status'] = "Invalid home directory";
        results.append(result)

  def osdiskAvailableSpace(self, path):
    diskInfo = {}
    try:
      df = subprocess.Popen(["df", "-kPT", path], stdout=subprocess.PIPE)
      dfdata = df.communicate()[0]
      return Hardware.extractMountInfo(dfdata.splitlines()[-1])
    except:
      pass
    return diskInfo

  def checkFolders(self, basePaths, projectNames, existingUsers, dirs):
    foldersToIgnore = []
    for user in existingUsers:
      foldersToIgnore.append(user['homeDir'])
    try:
      for dirName in basePaths:
        for project in projectNames:
          path = os.path.join(dirName.strip(), project.strip())
          if not path in foldersToIgnore and os.path.exists(path):
            obj = {}
            obj['type'] = self.dirType(path)
            obj['name'] = path
            dirs.append(obj)
    except:
      pass

  def javaProcs(self, list):
    try:
      pids = [pid for pid in os.listdir('/proc') if pid.isdigit()]
      for pid in pids:
        cmd = open(os.path.join('/proc', pid, 'cmdline'), 'rb').read()
        cmd = cmd.replace('\0', ' ')
        if not 'AmbariServer' in cmd:
          if 'java' in cmd:
            dict = {}
            dict['pid'] = int(pid)
            dict['hadoop'] = False
            for filter in self.PROC_FILTER:
              if filter in cmd:
                dict['hadoop'] = True
            dict['command'] = cmd.strip()
            for line in open(os.path.join('/proc', pid, 'status')):
              if line.startswith('Uid:'):
                uid = int(line.split()[1])
                dict['user'] = pwd.getpwuid(uid).pw_name
            list.append(dict)
    except:
      pass
    pass

  def getReposToRemove(self, repos, ignoreList):
    reposToRemove = []
    for repo in repos:
      addToRemoveList = True
      for ignoreRepo in ignoreList:
        if self.packages.nameMatch(ignoreRepo, repo):
          addToRemoveList = False
          continue
      if addToRemoveList:
        reposToRemove.append(repo)
    return reposToRemove

  def getUMask(self):
    if (self.current_umask == -1):
     self.current_umask = os.umask(self.current_umask)
     os.umask(self.current_umask)
     return self.current_umask
    else:
     return self.current_umask

  def getFirewallObject(self):
    if OS_TYPE == OS_UBUNTU:
      return UbuntuFirewallChecks()
    elif OS_TYPE == OS_FEDORA and int(OS_VERSION) >= 18:
      return Fedora18FirewallChecks()
    elif OS_TYPE == OS_SUSE or OS_TYPE == OS_OPENSUSE or OS_TYPE == OS_SUSE_ENTERPRISE:
      return SuseFirewallChecks()
    else:
      return FirewallChecks()

  def getFirewallObjectTypes(self):
    # To support test code, so tests can loop through the types
    return (FirewallChecks,
            UbuntuFirewallChecks,
            Fedora18FirewallChecks,
            SuseFirewallChecks)

  def checkIptables(self):
    return self.getFirewallObject().check_iptables()

  """ Return various details about the host
  componentsMapped: indicates if any components are mapped to this host
  commandsInProgress: indicates if any commands are in progress
  """
  def register(self, dict, componentsMapped=True, commandsInProgress=True):
    dict['hostHealth'] = {}

    java = []
    self.javaProcs(java)
    dict['hostHealth']['activeJavaProcs'] = java

    liveSvcs = []
    self.checkLiveServices(self.DEFAULT_LIVE_SERVICES, liveSvcs)
    dict['hostHealth']['liveServices'] = liveSvcs
    
    dict['umask'] = str(self.getUMask())

    # detailed host check is not available for Suse
    isSuse =  'suse' == OSCheck.get_os_family()

    dict['iptablesIsRunning'] = self.checkIptables()

    # If commands are in progress or components are already mapped to this host
    # Then do not perform certain expensive host checks
    if componentsMapped or commandsInProgress or isSuse:
      dict['existingRepos'] = [self.RESULT_UNAVAILABLE]
      dict['installedPackages'] = []
      dict['alternatives'] = []
      dict['stackFoldersAndFiles'] = []
      dict['existingUsers'] = []

    else:
      etcs = []
      self.etcAlternativesConf(self.DEFAULT_PROJECT_NAMES, etcs)
      dict['alternatives'] = etcs

      existingUsers = []
      self.checkUsers(self.DEFAULT_USERS, existingUsers)
      dict['existingUsers'] = existingUsers

      dirs = []
      self.checkFolders(self.DEFAULT_DIRS, self.DEFAULT_PROJECT_NAMES, existingUsers, dirs)
      dict['stackFoldersAndFiles'] = dirs

      installedPackages = []
      availablePackages = []
      self.packages.allInstalledPackages(installedPackages)
      self.packages.allAvailablePackages(availablePackages)

      repos = []
      self.packages.getInstalledRepos(self.PACKAGES, installedPackages + availablePackages,
                                      self.IGNORE_PACKAGES_FROM_REPOS, repos)
      packagesInstalled = self.packages.getInstalledPkgsByRepo(repos, self.IGNORE_PACKAGES, installedPackages)
      additionalPkgsInstalled = self.packages.getInstalledPkgsByNames(
        self.ADDITIONAL_PACKAGES, installedPackages)
      allPackages = list(set(packagesInstalled + additionalPkgsInstalled))
      dict['installedPackages'] = self.packages.getPackageDetails(installedPackages, allPackages)

      repos = self.getReposToRemove(repos, self.IGNORE_REPOS)
      dict['existingRepos'] = repos

      self.reportFileHandler.writeHostCheckFile(dict)
      pass

    # The time stamp must be recorded at the end
    dict['hostHealth']['agentTimeStampAtReporting'] = int(time.time() * 1000)

    pass


class FirewallChecks(object):
  def __init__(self):
    self.FIREWALL_SERVICE_NAME = "iptables"
    self.SERVICE_CMD = SERVICE_CMD
    self.SERVICE_SUBCMD = "status"

  def get_command(self):
    return "%s %s %s" % (self.SERVICE_CMD, self.FIREWALL_SERVICE_NAME, self.SERVICE_SUBCMD)

  def check_result(self, retcode, out, err):
      return retcode == 0

  def check_iptables(self):
    retcode, out, err = self.run_os_command(self.get_command())
    return self.check_result(retcode, out, err)

  def get_running_result(self):
    # To support test code.  Expected ouput from run_os_command.
    return (0, "", "")

  def get_stopped_result(self):
    # To support test code.  Expected output from run_os_command.
    return (3, "", "")
    
  def run_os_command(self, cmd):
    if type(cmd) == str:
      cmd = shlex.split(cmd)
      
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stdin=subprocess.PIPE,
      stderr=subprocess.PIPE)
                               
    (stdoutdata, stderrdata) = process.communicate()
    return process.returncode, stdoutdata, stderrdata    


class UbuntuFirewallChecks(FirewallChecks):
  def __init__(self):
    super(UbuntuFirewallChecks, self).__init__()

    self.FIREWALL_SERVICE_NAME = "ufw"
    self.SERVICE_CMD = 'service'

  def check_result(self, retcode, out, err):
    # On ubuntu, the status command returns 0 whether running or not
    return out and len(out) > 0 and out.strip() != "ufw stop/waiting"

  def get_running_result(self):
    # To support test code.  Expected ouput from run_os_command.
    return (0, "ufw start/running", "")

  def get_stopped_result(self):
    # To support test code.  Expected output from run_os_command.
    return (0, "ufw stop/waiting", "")


class Fedora18FirewallChecks(FirewallChecks):
  def __init__(self):
    self.FIREWALL_SERVICE_NAME = "firewalld.service"

  def get_command(self):
    return "systemctl is-active firewalld.service"


class SuseFirewallChecks(FirewallChecks):
  def __init__(self):
    self.FIREWALL_SERVICE_NAME = "SuSEfirewall2"

  def get_command(self):
    return "/sbin/SuSEfirewall2 status"


def main(argv=None):
  h = HostInfo()
  struct = {}
  h.register(struct)
  print struct


if __name__ == '__main__':
  main()