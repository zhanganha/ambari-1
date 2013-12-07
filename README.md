Spark\Shark integration with Apache Ambari
======
Deploy and manage Spark\Shark sytems on your cluster using Apache Ambari.

### Ambari
The [Apache Ambari project](http://ambari.apache.org/) is aimed at making Hadoop management simpler by developing software for provisioning, managing, and monitoring Apache Hadoop clusters.

### Spark\Shark
[Apache Spark](http://spark.incubator.apache.org/) is an open source cluster computing system that aims to make data analytics fast — both fast to run and fast to write

[Shark](https://github.com/amplab/shark) is a large-scale data warehouse system for Spark designed to be compatible with Apache Hive. 


### Work done by NFLabs
We at [NFLabs](http://nflabs.com) think that Ambari is an awsome cluter-managemnt platform and egar to help it to become even more usefull for others.

Right now new service can not be added to Ambari only through declaration (this work is in
[early stages now](https://issues.apache.org/jira/browse/AMBARI-2714)) it requires a code modification both, server and client side.

Here is our integration scope and current status:
 - [x] Spark\Shark installation though wizzard using custom stack NFL definition
 - [ ] Spark\Shark configuration though GUI 
      Right now this step is done by hand after the installation, see our [example](https://gist.github.com/alexander-bzz/64f62779f8d7757e1696)
 - [x] Spark\Shark service managemnt: start\stop through web ui
 - [ ] Spark\Shark service monitoring i.e gangilla metrics
 - [ ] Migration to HDP-1.4

Current integration work is based on (recently obsolete) Ambari version 1.3.2 (branch\stack name)


[![githalytics.com alpha](https://cruel-carlota.pagodabox.com/9b95a12b07642bccfb7c174d085b6bd4 "githalytics.com")](http://githalytics.com/NFLabs/ambari)
