(function(/*! Brunch !*/) {
  'use strict';

  var globals = typeof window !== 'undefined' ? window : global;
  if (typeof globals.require === 'function') return;

  var modules = {};
  var cache = {};

  var has = function(object, name) {
    return ({}).hasOwnProperty.call(object, name);
  };

  var expand = function(root, name) {
    var results = [], parts, part;
    if (/^\.\.?(\/|$)/.test(name)) {
      parts = [root, name].join('/').split('/');
    } else {
      parts = name.split('/');
    }
    for (var i = 0, length = parts.length; i < length; i++) {
      part = parts[i];
      if (part === '..') {
        results.pop();
      } else if (part !== '.' && part !== '') {
        results.push(part);
      }
    }
    return results.join('/');
  };

  var dirname = function(path) {
    return path.split('/').slice(0, -1).join('/');
  };

  var localRequire = function(path) {
    return function(name) {
      var dir = dirname(path);
      var absolute = expand(dir, name);
      return globals.require(absolute);
    };
  };

  var initModule = function(name, definition) {
    var module = {id: name, exports: {}};
    definition(module.exports, localRequire(name), module);
    var exports = cache[name] = module.exports;
    return exports;
  };

  var require = function(name) {
    var path = expand(name, '.');

    if (has(cache, path)) return cache[path];
    if (has(modules, path)) return initModule(path, modules[path]);

    var dirIndex = expand(path, './index');
    if (has(cache, dirIndex)) return cache[dirIndex];
    if (has(modules, dirIndex)) return initModule(dirIndex, modules[dirIndex]);

    throw new Error('Cannot find module "' + name + '"');
  };

  var define = function(bundle, fn) {
    if (typeof bundle === 'object') {
      for (var key in bundle) {
        if (has(bundle, key)) {
          modules[key] = bundle[key];
        }
      }
    } else {
      modules[bundle] = fn;
    }
  };

  globals.require = require;
  globals.require.define = define;
  globals.require.register = define;
  globals.require.brunch = true;
})();

window.require.register("test/app_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  describe('#App', function() {

    describe('App.components', function() {

      it('slaves and masters should not intersect', function() {
        var intersected = App.get('components.slaves').filter(function(item){
          return App.get('components.masters').contains(item);
        });
        expect(intersected).to.eql([]);
      });

      it('decommissionAllowed', function() {
        expect(App.get('components.decommissionAllowed')).to.eql(["DATANODE", "TASKTRACKER", "NODEMANAGER", "HBASE_REGIONSERVER"]);
      });

      it('addableToHost', function() {
        expect(App.get('components.addableToHost')).to.eql(["DATANODE", "TASKTRACKER", "NODEMANAGER", "HBASE_REGIONSERVER", "HBASE_MASTER", "ZOOKEEPER_SERVER", "SUPERVISOR"]);
      });

    });

    describe('App.isHadoop21Stack', function() {
      var tests = [{
        v:'',
        e:false
      }, {
        v:'HDP',
        e: false
      }, {
        v:'HDP1',
        e: false
      }, {
        v:'HDP-1',
        e: false
      }, {
        v:'HDP-2.0',
        e: false
      }, {
        v:'HDP-2.0.1000',
        e: false
      }, {
        v:'HDP-2.1',
        e: true
      }, {
        v:'HDP-2.1.3434',
        e: true
      }, {
        v:'HDP-2.2',
        e: true
      }, {
        v:'HDP-2.2.1212',
        e: true
      }];
      tests.forEach(function(test){
        it(test.v, function() {
          App.QuickViewLinks.prototype.setQuickLinks = function(){};
          App.set('currentStackVersion', test.v);
          var calculated = App.get('isHadoop21Stack');
          var expected = test.e;
          expect(calculated).to.equal(expected);
        });
      });
    });

    describe('Disable/enable components', function() {
      var testableComponent =  {
        service_name: 'YARN',
        component_name: 'APP_TIMELINE_SERVER'
      };
      var expectedInfo = {
        componentName: 'APP_TIMELINE_SERVER',
        properties: {
          global_properties: ['ats_host', 'apptimelineserver_heapsize'],
          site_properties: ['yarn.timeline-service.generic-application-history.store-class', 'yarn.timeline-service.store-class', 'yarn.timeline-service.leveldb-timeline-store.path']
        },
        reviewConfigs: {
          component_name: 'APP_TIMELINE_SERVER'
        },
        configCategory: {
          name: 'AppTimelineServer'
        }
      };
      var globalProperties = require('data/HDP2/global_properties');
      var siteProperties = require('data/HDP2/site_properties');
      var serviceComponents = require('data/service_components');
      var reviewConfigs = require('data/review_configs');
      var disableResult;

      App.set('currentStackVersion', 'HDP-2.1');
      App.set('handleStackDependencyTest', true);

      describe('#disableComponent()', function() {
        disableResult = App.disableComponent(testableComponent);
        // copy
        var _globalProperties = $.extend({}, globalProperties);
        var _siteProperties = $.extend({}, siteProperties);
        var _serviceComponents = $.extend({}, serviceComponents);
        var _reviewConfigs = JSON.parse(JSON.stringify(reviewConfigs));

        describe('result validation', function() {

          it('component name should be "' + expectedInfo.componentName + '"', function() {
            expect(disableResult.get('componentName')).to.eql(expectedInfo.componentName);
          });

          it('config category name should be "' + expectedInfo.configCategory.name +'"', function() {
            expect(disableResult.get('configCategory.name')).to.eql(expectedInfo.configCategory.name);
          });

          for(var siteName in expectedInfo.properties) {
            (function(site) {
              expectedInfo.properties[site].forEach(function(property) {
                it(property + ' present in ' + site, function() {
                  expect(disableResult.get('properties.' + site).mapProperty('name')).to.include(property);
                });
              }, this);
            })(siteName);
          }

          it('site and global properties should not be equal', function() {
            expect(disableResult.get('properties.global_properties')).to.not.include.members(disableResult.get('properties.site_properties'));
          });


        });

        describe('effect validation',function() {

          it('should remove component from service_components object', function() {
            expect(_serviceComponents.findProperty('component_name', testableComponent.component_name)).to.be.undefined;
          });

          it('should remove global properties of component', function() {
            expect(_globalProperties.configProperties.mapProperty('name')).to.not.include.members(expectedInfo.properties.global_properties);
          });

          it('should remove site properties of component', function() {
            expect(_siteProperties.configProperties.mapProperty('name')).to.not.include.members(expectedInfo.properties.site_properties);
          });

          it('should remove review config for component', function() {
            var reviewConfig = _reviewConfigs.findProperty('config_name', 'services')
              .config_value.findProperty('service_name', testableComponent.service_name)
              .service_components.mapProperty('component_name');
            expect(reviewConfig).to.not.include(expectedInfo.reviewConfigs.component_name);
          });
        });
      });

      describe('#enableComponent', function() {
        App.enableComponent(disableResult);

        it('should add component to service_components object', function() {
          expect(serviceComponents.findProperty('component_name', testableComponent.component_name)).to.exist;
        });

        it('should add global properties of component', function() {
          expect(globalProperties.configProperties.mapProperty('name')).to.include.members(expectedInfo.properties.global_properties);
        });

        it('should add site properties of component', function() {
          expect(siteProperties.configProperties.mapProperty('name')).to.include.members(expectedInfo.properties.site_properties);
        });

        it('should add review config for component', function() {
          var reviewConfig = reviewConfigs.findProperty('config_name', 'services')
            .config_value.findProperty('service_name', testableComponent.service_name)
            .get('service_components').mapProperty('component_name');
          expect(reviewConfig).to.include(expectedInfo.reviewConfigs.component_name);
        });
      });
    });

  });
  
});
window.require.register("test/controllers/global/background_operations_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');

  require('config');
  require('utils/updater');
  require('utils/ajax');

  require('models/host_component');

  require('controllers/global/background_operations_controller');
  require('views/common/modal_popup');
  require('utils/host_progress_popup');

  var controller;

  describe('App.BackgroundOperationsController', function () {

    /**
     * Predefined data
     *
     */
    App.set('clusterName', 'testName');
    App.bgOperationsUpdateInterval = 100;

    var tests = Em.A([
      {
        levelInfo: Em.Object.create({
          name: 'REQUESTS_LIST',
          requestId: null,
          taskId: null,
          sync: false
        }),
        e: {
          name: 'background_operations.get_most_recent',
          successCallback: 'callBackForMostRecent',
          data: {}
        },
        response: {items:[]},
        m: '"Get Most Recent"'
      },
      {
        levelInfo: Em.Object.create({
          name: 'TASK_DETAILS',
          requestId: 1,
          taskId: 1,
          sync: false
        }),
        e: {
          name: 'background_operations.get_by_task',
          successCallback: 'callBackFilteredByTask',
          data: {
            taskId: 1,
            requestId: 1,
            sync: false
          }
        },
        response: {items:{Tasks:{request_id:0}}},
        m: '"Filtered By task"'
      },
      {
        levelInfo: Em.Object.create({
          name: 'TASKS_LIST',
          requestId: 1,
          taskId: 1,
          sync: false
        }),
        e: {
          name: 'background_operations.get_by_request',
          successCallback: 'callBackFilteredByRequest',
          data: {
            requestId: 1,
            sync: false
          }
        },
        response: {items:{Requests:{id:0}}},
        m: '"Filtered By Request (TASKS_LIST)"'
      },
      {
        levelInfo: Em.Object.create({
          name: 'HOSTS_LIST',
          requestId: 1,
          taskId: 1,
          sync: false
        }),
        e: {
          name: 'background_operations.get_by_request',
          successCallback: 'callBackFilteredByRequest',
          data: {
            requestId: 1,
            sync: false
          }
        },
        response: {items:{Requests:{id:0}}},
        m: '"Filtered By Request (HOSTS_LIST)"'
      }
    ]);

    describe('#getQueryParams', function() {
      beforeEach(function() {
        controller = App.BackgroundOperationsController.create();
        App.testMode = false;
      });
      afterEach(function() {
        App.testMode = true;
      });

      tests.forEach(function(test) {
        it(test.m, function() {
          controller.set('levelInfo', test.levelInfo);
          var r = controller.getQueryParams();
          expect(r.name).to.equal(test.e.name);
          expect(r.successCallback).to.equal(test.e.successCallback);
          expect(r.data).to.eql(test.e.data);
        });
      });
    });

  });
  
});
window.require.register("test/controllers/global/cluster_controller_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('controllers/global/cluster_controller');
  require('models/host_component');
  require('utils/http_client');
  require('models/service');

  describe('App.clusterController', function () {
    var controller = App.ClusterController.create();
    App.Service.FIXTURES = [{service_name: 'NAGIOS'}];

    describe('#updateLoadStatus()', function () {

      controller.set('dataLoadList', Em.Object.create({
        'item1':false,
        'item2':false
      }));

      it('when none item is loaded then width should be "width:0"', function(){
        expect(controller.get('clusterDataLoadedPercent')).to.equal('width:0');
      });
      it('when first item is loaded then isLoaded should be false', function(){
        controller.updateLoadStatus.call(controller, 'item1');
        expect(controller.get('isLoaded')).to.equal(false);
      });
      it('when first item is loaded then width should be "width:50%"', function(){
        controller.updateLoadStatus.call(controller, 'item1');
        expect(controller.get('clusterDataLoadedPercent')).to.equal('width:50%');
      });

      it('when all items are loaded then isLoaded should be true', function(){
        controller.updateLoadStatus.call(controller, 'item2');
        expect(controller.get('isLoaded')).to.equal(true);
      });
      it('when all items are loaded then width should be "width:100%"', function(){
        controller.updateLoadStatus.call(controller, 'item2');
        expect(controller.get('clusterDataLoadedPercent')).to.equal('width:100%');
      });
    });

    describe('#loadClusterNameSuccessCallback', function() {
      var test_data = {
        "items" : [
          {
            "Clusters" : {
              "cluster_name" : "tdk",
              "version" : "HDP-1.3.0"
            }
          }
        ]
      };
      controller.loadClusterNameSuccessCallback(test_data);
      it('Check cluster', function() {
        expect(controller.get('cluster.Clusters.cluster_name')).to.equal('tdk');
        expect(controller.get('cluster.Clusters.version')).to.equal('HDP-1.3.0');
        expect(App.get('clusterName')).to.equal('tdk');
      });
    });

    describe('#loadClusterNameErrorCallback', function() {
      controller.loadClusterNameErrorCallback();
      it('', function() {
        expect(controller.get('isLoaded')).to.equal(true);
      });
    });

    describe('#getUrl', function() {
      controller.set('clusterName', 'tdk');
      var tests = ['test1', 'test2', 'test3'];
      it('testMode = true', function() {
        App.testMode = true;
        tests.forEach(function(test) {
          expect(controller.getUrl(test, test)).to.equal(test);
        });
      });
      it('testMode = false', function() {
        App.testMode = false;
        tests.forEach(function(test) {
          expect(controller.getUrl(test, test)).to.equal(App.apiPrefix + '/clusters/' + controller.get('clusterName') + test);
        });
      });
    });

  });
});
window.require.register("test/controllers/installer_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('models/cluster');
  require('controllers/wizard');
  require('controllers/installer');

  describe('App.InstallerController', function () {

    var installerController = App.InstallerController.create();

    describe('#loadStacksVersionsSuccessCallback', function() {
      var test_data = {
        "items" : [
          {
            "Versions" : {
              "active" : false,
              "min_upgrade_version" : null,
              "stack_name" : "HDP",
              "stack_version" : "1.2.0"
            }
          },
          {
            "Versions" : {
              "active" : true,
              "min_upgrade_version" : null,
              "stack_name" : "HDP",
              "stack_version" : "1.2.1"
            }
          },
          {
            "Versions" : {
              "active" : true,
              "min_upgrade_version" : "1.2.0",
              "stack_name" : "HDP",
              "stack_version" : "1.3.0"
            }
          },
          {
            "Versions" : {
              "active" : false,
              "min_upgrade_version" : null,
              "stack_name" : "HDP",
              "stack_version" : "2.0.1"
            }
          }
        ]
      };
      it ('Correct data', function() {
        installerController.loadStacksVersionsSuccessCallback(test_data);
        expect(installerController.get('stacks.length')).to.equal(2);
        expect(installerController.get('stacks').everyProperty('isSelected')).to.equal(false);
        expect(installerController.get('stacks').mapProperty('name')).to.eql(['HDP-1.3.0', 'HDP-1.2.1']);
      });
    });



  });
  
});
window.require.register("test/controllers/main/admin/cluster_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('controllers/main/admin/cluster');


  describe('App.MainAdminClusterController', function () {

    App.set('currentStackVersion', 'HDP-1.2.2');
    App.set('defaultStackVersion', 'HDP-1.2.2');
    var data = {
      "items" : [
        {
          "Versions" : {
            "stack_version" : "1.3.1",
            "min_upgrade_version" : "1.2.0"
          }
        },               
        {
          "Versions" : {
            "stack_version" : "1.3.0",
            "min_upgrade_version" : "1.2.0"
          }
        },
        {
          "Versions" : {
            "stack_version" : "1.2.2",
            "min_upgrade_version" : "1.2.0"
          }
        },
        {
          "Versions" : {
            "stack_version" : "1.2.0",
            "min_upgrade_version" : "1.2.0"
          }
        }
      ]
    };

    describe('#updateUpgradeVersionSuccessCallback()', function () {
      it('upgrade version of stack should be "HDP-1.3.0"', function(){
        var controller = App.MainAdminClusterController.create({
          parseServicesInfo:function(){}
        });
        controller.updateUpgradeVersionSuccessCallback.call(controller, data);
        expect(controller.get('upgradeVersion')).to.equal('HDP-1.3.1');
      });
      it('if min upgrade version less then current then upgrade version equal current', function(){
        data.items[0].Versions.min_upgrade_version = "1.2.3";
        var controller = App.MainAdminClusterController.create({
          parseServicesInfo:function(){}
        });
        controller.updateUpgradeVersionSuccessCallback.call(controller, data);
        expect(controller.get('upgradeVersion')).to.equal('HDP-1.2.2');
      })
    })
  });
  
});
window.require.register("test/controllers/main/admin/security/add/addSecurity_controller_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('models/host');
  require('controllers/wizard');
  require('controllers/main/admin/security/add/addSecurity_controller');
  require('models/host_component');
  require('models/cluster');
  require('models/service');

  describe('App.AddSecurityController', function () {

    var addSecurityController = App.AddSecurityController.create();

    describe('#clearServices', function() {
      addSecurityController.set('content.services', [{},{},{}]);
      it('clear all services', function() {
        addSecurityController.clearServices();
        expect(addSecurityController.get('content.services.length')).to.equal(0);
      });
    });

    describe('#loadServices', function() {

      it('NAGIOS, HIVE and GENERAL (by default). FAKE not loaded', function() {
        var ASC = App.AddSecurityController.extend({
          installedServices: ['NAGIOS', 'HIVE', 'FAKE']
        });
        var c = ASC.create();
        c.loadServices();
        expect(c.get('content.services.length')).to.equal(3);
      });
    });

  });
  
});
window.require.register("test/controllers/main/admin/security/add/step2_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('controllers/main/admin/security/add/step2');
  require('utils/polling');
  require('models/cluster_states');

  describe('App.MainAdminSecurityAddStep2Controller', function () {

    var mainAdminSecurityAddStep2Controller = App.MainAdminSecurityAddStep2Controller.create();

    describe('#clearStep', function() {
      mainAdminSecurityAddStep2Controller.set('stepConfigs',[1,2,3]);
      it('clear', function() {
        mainAdminSecurityAddStep2Controller.clearStep();
        expect(mainAdminSecurityAddStep2Controller.get('stepConfigs.length')).to.equal(0);
      });
    });

    describe('#isSubmitDisabled', function() {
      var tests = [
        {
          config:[
            {
              showConfig: true,
              errorCount: 0
            }
          ],
          m: 'All show configs, nothing with errors',
          e: false
        },
        {
          config:[
            {
              showConfig: true,
              errorCount: 0
            },
            {
              showConfig: true,
              errorCount: 1
            }
          ],
          m: 'All show configs, 1 with errors',
          e: true
        },
        {
          config:[
            {
              showConfig: true,
              errorCount: 0
            },
            {
              showConfig: false,
              errorCount: 1
            }
          ],
          m: '1 has errors but not visible',
          e: false
        },
        {
          config:[
            {
              showConfig: false,
              errorCount: 0
            },
            {
              showConfig: false,
              errorCount: 1
            }
          ],
          m: '1 has errors, all not visible',
          e: false
        },
        {
          config:[
            {
              showConfig: true,
              errorCount: 1
            },
            {
              showConfig: true,
              errorCount: 1
            }
          ],
          m: 'All has errors, all not visible',
          e: true
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          mainAdminSecurityAddStep2Controller.set('stepConfigs', test.config);
          expect(mainAdminSecurityAddStep2Controller.get('isSubmitDisabled')).to.equal(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/controllers/main/admin/security/add/step3_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');

  require('controllers/main/admin/security/add/step3');
  require('models/host_component');
  require('models/host');
  require('models/service');

  describe('App.MainAdminSecurityAddStep3Controller', function () {

    var mainAdminSecurityAddStep3Controller = App.MainAdminSecurityAddStep3Controller.create();

    describe('#getSecurityUsers', function() {
      it('no hosts, just check users (testMode = true)', function() {
        App.testMode = true;
        expect(mainAdminSecurityAddStep3Controller.getSecurityUsers().length).to.equal(11);
      });
    });

    describe('#changeDisplayName', function() {
      it('HiveServer2', function() {
        expect(mainAdminSecurityAddStep3Controller.changeDisplayName('HiveServer2')).to.equal('Hive Metastore and HiveServer2');
      });
      it('Not HiveServer2', function() {
        expect(mainAdminSecurityAddStep3Controller.changeDisplayName('something')).to.equal('something');
      });
    });

  });
  
});
window.require.register("test/controllers/main/admin/security/add/step4_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('controllers/main/admin/security/security_progress_controller');
  require('controllers/main/admin/security/add/step4');
  require('utils/polling');
  require('models/cluster_states');

  describe('App.MainAdminSecurityAddStep4Controller', function () {

    /**
     * Test object
     */
    var controller = App.MainAdminSecurityAddStep4Controller.create();

    describe('#moveToNextCommand()', function () {
      controller.reopen({
        saveCommands: function(){},
        enableSubmit: function(){},
        loadClusterConfigs: function(){}
      });
      App.clusterStatus.reopen({
        setClusterStatus: function(){}
      });

      controller.set('commands', [
        App.Poll.create({name: 'STOP_SERVICES', isStarted: false, isPolling: true, isCompleted: false, start: function(){}}),
        App.Poll.create({name: 'APPLY_CONFIGURATIONS', isStarted: false, isPolling: false, isCompleted: false, start: function(){}}),
        App.Poll.create({name: 'START_SERVICES', isStarted: false, isPolling: true, isCompleted: false, start: function(){}})
      ]);

      it('STOP_SERVICES is started', function(){
        controller.moveToNextCommand(controller.get('commands').findProperty('name', 'STOP_SERVICES'));
        expect(controller.get('commands').findProperty('name', 'STOP_SERVICES').get('isStarted')).to.equal(true);
      });

      it('APPLY_CONFIGURATIONS is started', function(){
        controller.moveToNextCommand(controller.get('commands').findProperty('name', 'APPLY_CONFIGURATIONS'));
        expect(controller.get('commands').findProperty('name', 'APPLY_CONFIGURATIONS').get('isStarted')).to.equal(true);
      });

      it('START_SERVICES is started', function(){
        controller.moveToNextCommand(controller.get('commands').findProperty('name', 'START_SERVICES'));
        expect(controller.get('commands').findProperty('name', 'START_SERVICES').get('isStarted')).to.equal(true);
      });
    });

    describe('#loadCommands()', function() {
      describe('YARN installed with ATS', function() {
        beforeEach(function(){
          controller.reopen({
            secureServices: function() {
              return [
                Em.Object.create({
                  serviceName: 'YARN'
                })
              ];
            }.property()
          });
          controller.set('commands', []);
          controller.set('totalSteps', 3);
          var service = {
            id: 'YARN',
            service_name: 'YARN',
            host_components: ['APP_TIMLINE_SERVER_c6401.ambari.apache.org']
          };
          var hostComponent = {
            component_name: 'APP_TIMELINE_SERVER',
            id: 'APP_TIMLINE_SERVER_c6401.ambari.apache.org',
            service_id: 'YARN'
          };
          App.store.load(App.HostComponent, hostComponent);
          App.store.load(App.Service, service);
          controller.loadCommands();
        });

        it('delete ATS component stage should be after APPLY_CONFIGURATIONS', function() {
          expect(controller.get('commands').indexOf(controller.get('commands').findProperty('name','DELETE_ATS'))).to.eql(2);
        });

        it('commands length should be equal to 4', function() {
          expect(controller.get('commands').length).to.eql(4);
        });

        it('total steps should be equal to 4', function() {
          expect(controller.get('totalSteps')).to.eql(4);
        });
      });

      describe('YARN installed without ATS', function() {
        beforeEach(function(){
          controller.reopen({
            secureServices: function() {
              return [
                Em.Object.create({
                  serviceName: 'YARN'
                })
              ];
            }.property()
          });
          controller.set('commands', []);
          controller.set('totalSteps', 3);
          var service = {
            id: 'YARN',
            service_name: 'YARN',
            host_components: []
          };
          App.store.load(App.Service, service);
          controller.loadCommands();
        });

        it('commands length should be equal to 3', function() {
          expect(controller.get('commands').length).to.eql(3);
        });

        it('total steps should be equal to 3', function() {
          expect(controller.get('totalSteps')).to.eql(3);
        });
      });

    });
  });
  
});
window.require.register("test/controllers/main/app_contoller_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('utils/helper');
  require('controllers/main/apps_controller');

  describe('MainAppsController', function () {


     describe('#iTotalDisplayRecordsObserver()', function () {
       it('should set number of filtered jobs when switching to all jobs', function () {
         var mainAppsController = App.MainAppsController.create();
         mainAppsController.set("paginationObject.iTotalDisplayRecords", 5);
         expect(mainAppsController.get('filterObject.filteredDisplayRecords')).to.equal(5);
       })
     });


     describe('#filterObject.onRunTypeChange()', function () {
       it('should set sSearch_2 of filterObject when changing value of filterObject.runType', function () {
         var mainAppsController = App.MainAppsController.create();
         mainAppsController.set("filterObject.runType", "MapReduce");
         expect(mainAppsController.get('filterObject.sSearch_2')).to.equal("mr");
         mainAppsController.set("filterObject.runType", "Hive");
         expect(mainAppsController.get('filterObject.sSearch_2')).to.equal("hive");
         mainAppsController.set("filterObject.runType", "Pig");
         expect(mainAppsController.get('filterObject.sSearch_2')).to.equal("pig");
       })
     });

     describe('#filterObject.onJobsChange()', function () {
       it('should set minJobs,maxJobs of filterObject when changing value of filterObject.jobs', function () {
         var mainAppsController = App.MainAppsController.create();
         mainAppsController.set("filterObject.jobs", ">3");
         expect(mainAppsController.get('filterObject.minJobs')).to.equal("3");
         expect(mainAppsController.get('filterObject.maxJobs')).to.equal("");
         mainAppsController.set("filterObject.jobs", "<3");
         expect(mainAppsController.get('filterObject.minJobs')).to.equal("");
         expect(mainAppsController.get('filterObject.maxJobs')).to.equal("3");
         mainAppsController.set("filterObject.jobs", "3");
         expect(mainAppsController.get('filterObject.minJobs')).to.equal("3");
         expect(mainAppsController.get('filterObject.maxJobs')).to.equal("3");
         mainAppsController.set("filterObject.jobs", "=3");
         expect(mainAppsController.get('filterObject.minJobs')).to.equal("3");
         expect(mainAppsController.get('filterObject.maxJobs')).to.equal("3");
       })
     });

     describe('#filterObject.onDurationChange()', function () {
       it('should set minDuration,maxDuration of filterObject when changing value of filterObject.duration', function () {
         var mainAppsController = App.MainAppsController.create();
         mainAppsController.set("filterObject.duration", ">3h");
         expect(mainAppsController.get('filterObject.minDuration')).to.equal(10799640);
         expect(mainAppsController.get('filterObject.maxDuration')).to.equal("");
         mainAppsController.set("filterObject.duration", "<6m");
         expect(mainAppsController.get('filterObject.minDuration')).to.equal("");
         expect(mainAppsController.get('filterObject.maxDuration')).to.equal(360060);
         mainAppsController.set("filterObject.duration", "10s");
         expect(mainAppsController.get('filterObject.minDuration')).to.equal(9990);
         expect(mainAppsController.get('filterObject.maxDuration')).to.equal(10010);
         mainAppsController.set("filterObject.duration", "1");
         expect(mainAppsController.get('filterObject.minDuration')).to.equal(990);
         expect(mainAppsController.get('filterObject.maxDuration')).to.equal(1010);
       })
     });

     describe('#filterObject.onRunDateChange()', function () {
       it('should set minStartTime,maxStartTime of filterObject when changing value of filterObject.runDate', function () {
         var mainAppsController = App.MainAppsController.create();
         mainAppsController.set("filterObject.runDate", "Any");
         expect(mainAppsController.get('filterObject.minStartTime')).to.equal("");
         mainAppsController.set("filterObject.runDate", "Past 1 Day");
         expect(mainAppsController.get('filterObject.minStartTime')).to.be.within(((new Date().getTime())-86400000)-1000,((new Date().getTime())-86400000)+1000);
         mainAppsController.set("filterObject.runDate", "Past 2 Days");
         expect(mainAppsController.get('filterObject.minStartTime')).to.be.within(((new Date().getTime())-172800000)-1000,((new Date().getTime())-172800000)+1000);
         mainAppsController.set("filterObject.runDate", "Past 7 Days");
         expect(mainAppsController.get('filterObject.minStartTime')).to.be.within(((new Date().getTime())-604800000)-1000,((new Date().getTime())-604800000)+1000);
         mainAppsController.set("filterObject.runDate", "Past 14 Days");
         expect(mainAppsController.get('filterObject.minStartTime')).to.be.within(((new Date().getTime())-1209600000)-1000,((new Date().getTime())-1209600000)+1000);
         mainAppsController.set("filterObject.runDate", "Past 30 Days");
         expect(mainAppsController.get('filterObject.minStartTime')).to.be.within(((new Date().getTime())-2592000000)-1000,((new Date().getTime())-2592000000)+1000);
       })
     });

     describe('#filterObject.createAppLink(), #filterObject.valueObserver()', function () {
       var mainAppsController = App.MainAppsController.create();
       mainAppsController.set('content.length', 20);
       it('should set runUrl of filterObject when changing value for any filter', function () {
         mainAppsController.set("filterObject.sSearch_0", "0");
         mainAppsController.set("filterObject.sSearch_1", "workflowName");
         mainAppsController.set("filterObject.sSearch_2", "pig");
         mainAppsController.set("filterObject.sSearch_3", "admin");
         mainAppsController.set("filterObject.minJobs", "1");
         mainAppsController.set("filterObject.maxJobs", "2");
         mainAppsController.set("filterObject.minDuration", "1000");
         mainAppsController.set("filterObject.maxDuration", "2000");
         mainAppsController.set("filterObject.minStartTime", "999");
         mainAppsController.set("filterObject.maxStartTime", "1000");
         mainAppsController.set("filterObject.sSearch", "searchTerm");
         mainAppsController.set("filterObject.iDisplayLength", "10");
         mainAppsController.set("filterObject.iDisplayStart", "10");
         mainAppsController.set("filterObject.iSortCol_0", "1");
         mainAppsController.set("filterObject.sSortDir_0", "ASC");
         expect(mainAppsController.get('runUrl')).to.equal("/jobhistory/datatable?" +
             "sSearch_0=0" +
             "&sSearch_1=workflowName" +
             "&sSearch_2=pig" +
             "&sSearch_3=admin" +
             "&minJobs=1" +
             "&maxJobs=2" +
             "&minDuration=1000" +
             "&maxDuration=2000" +
             "&minStartTime=999" +
             "&maxStartTime=1000" +
             "&sSearch=searchTerm" +
             "&iDisplayLength=10" +
             "&iDisplayStart=10" +
             "&iSortCol_0=1" +
             "&sSortDir_0=ASC");
         expect(mainAppsController.get('filterObject.viewType')).to.equal('filtered');
       });

       it('should set viewType to "all" when set iDisplayLength, iDisplayStart, iSortCol_0, sSortDir_0', function () {
         mainAppsController.set("filterObject.sSearch_0", "");
         mainAppsController.set("filterObject.sSearch_1", "");
         mainAppsController.set("filterObject.sSearch_2", "");
         mainAppsController.set("filterObject.sSearch_3", "");
         mainAppsController.set("filterObject.minJobs", "");
         mainAppsController.set("filterObject.maxJobs", "");
         mainAppsController.set("filterObject.minDuration", "");
         mainAppsController.set("filterObject.maxDuration", "");
         mainAppsController.set("filterObject.minStartTime", "");
         mainAppsController.set("filterObject.maxStartTime", "");
         mainAppsController.set("filterObject.sSearch", "");
         mainAppsController.set("filterObject.iDisplayLength", "10");
         mainAppsController.set("filterObject.iDisplayStart", "10");
         mainAppsController.set("filterObject.iSortCol_0", "1");
         mainAppsController.set("filterObject.sSortDir_0", "ASC");
         expect(mainAppsController.get('filterObject.viewType')).to.equal('all');
       });
     });




   });

  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_cpuWaitIO_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_cpuWaitIO');

  describe('App.MainChartHeatmapCpuWaitIOMetric', function () {

    var tests = [
      {
        json: {
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "cpu" : {
                  "cpu_wio" : 0.4
                }
              }
            }
          ]
        },
        m: 'One host',
        e: {'dev01.hortonworks.com': '40.0'}
      },
      {
        json: {
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "cpu" : {
                  "cpu_wio" : 0.4
                }
              }
            },
            {
              "Hosts" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "cpu" : {
                  "cpu_wio" : 0.34566
                }
              }
            }
          ]
        },
        m: 'Two hosts',
        e: {'dev01.hortonworks.com': '40.0', 'dev02.hortonworks.com': '34.6'}
      },
      {
        json: {
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "cpu" : {
                  "cpu_wio" : 0.4
                }
              }
            },
            {
              "Hosts" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "cpu" : {
                }
              }
            }
          ]
        },
        m: 'Two hosts, One without metric',
        e: {'dev01.hortonworks.com': '40.0'}
      }
    ];

    describe('#metricMapper()', function() {
      var mainChartHeatmapCpuWaitIOMetric = App.MainChartHeatmapCpuWaitIOMetric.create();

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = mainChartHeatmapCpuWaitIOMetric.metricMapper(test.json);
          expect(r).to.eql(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_dfs_bytesread_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_dfs');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_dfs_bytesread');

  describe('App.MainChartHeatmapDFSBytesReadMetric', function () {

    var tests = [
      {i: 0, e: 0},
      {i: 0.5 * 1024* 1024, e: 0.5},
      {i: 1024* 1024, e: 1},
      {i: 10.5 * 1024 * 1024,e: 10.5}
    ];

    describe('#transformValue()', function() {
      var mainChartHeatmapDFSBytesReadMetric = App.MainChartHeatmapDFSBytesReadMetric.create();

      tests.forEach(function(test) {
        it(test.i + ' bytes to ' + test.e + ' MB', function() {
          var r = mainChartHeatmapDFSBytesReadMetric.transformValue(test.i);
          expect(r).to.eql(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_dfs_byteswritten_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_dfs');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_dfs_byteswritten');

  describe('App.MainChartHeatmapDFSBytesWrittenMetric', function () {

    var tests = [
      {i: 0, e: 0},
      {i: 0.5 * 1024* 1024, e: 0.5},
      {i: 1024* 1024, e: 1},
      {i: 10.5 * 1024 * 1024,e: 10.5}
    ];

    describe('#transformValue()', function() {
      var mainChartHeatmapDFSBytesWrittenMetric = App.MainChartHeatmapDFSBytesWrittenMetric.create();

      tests.forEach(function(test) {
        it(test.i + ' bytes to ' + test.e + ' MB', function() {
          var r = mainChartHeatmapDFSBytesWrittenMetric.transformValue(test.i);
          expect(r).to.eql(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_dfs_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_dfs');

  describe('App.MainChartHeatmapDFSMetrics', function () {

    var tests = [
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "gcTimeMillis" : 285
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 285},
        m: 'One host_component'
      },
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "gcTimeMillis" : 285
                }
              }
            },
            {
              "HostRoles" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "gcTimeMillis" : 124
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 285, 'dev02.hortonworks.com': 124},
        m: 'Two host_components'
      },
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "gcTimeMillis" : 285
                }
              }
            },
            {
              "HostRoles" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {

                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 285},
        m: 'Two host_components, one without metric'
      }
    ];

    describe('#metricMapper()', function() {
      var mainChartHeatmapDFSMetrics = App.MainChartHeatmapDFSMetrics.create();
      mainChartHeatmapDFSMetrics.set('defaultMetric', 'metrics.jvm.gcTimeMillis');

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = mainChartHeatmapDFSMetrics.metricMapper(test.json);
          expect(r).to.eql(test.result);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_diskspaceused_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_diskspaceused');

  describe('App.MainChartHeatmapDiskSpaceUsedMetric', function () {

    var tests = Em.A([
      {
        json:{
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "disk" : {
                  "disk_free" : 89.973,
                  "disk_total" : 101.515
                }
              }
            }
          ]
        },
        m: 'One host',
        e: {'dev01.hortonworks.com': 11.37}
      },
      {
        json:{
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "disk" : {
                  "disk_free" : 89.973,
                  "disk_total" : 101.515
                }
              }
            },
            {
              "Hosts" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "disk" : {
                  "disk_free" : 89.973,
                  "disk_total" : 101.515
                }
              }
            }
          ]
        },
        m: 'Two hosts',
        e: {'dev01.hortonworks.com': 11.37, 'dev02.hortonworks.com': 11.37}
      },
      {
        json:{
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "disk" : {
                  "disk_free" : 89.973,
                  "disk_total" : 101.515
                }
              }
            },
            {
              "Hosts" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {

              }
            }
          ]
        },
        m: 'Two hosts, One without metric',
        e: {'dev01.hortonworks.com': 11.37}
      }
    ]);

    describe('#metricMapper()', function() {
      var mainChartHeatmapDiskSpaceUsedMetric = App.MainChartHeatmapDiskSpaceUsedMetric.create();

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = mainChartHeatmapDiskSpaceUsedMetric.metricMapper(test.json);
          expect(r).to.eql(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_hbase_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_hbase');

  describe('App.MainChartHeatmapHbaseMetrics', function () {

    var tests = [
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "hbase" : {
                  "regionserver" : {
                    "readRequestsCount" : 0.0
                  }
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 0},
        m: 'One host_component'
      },
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "hbase" : {
                  "regionserver" : {
                    "readRequestsCount" : 0.0
                  }
                }
              }
            },
            {
              "HostRoles" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "hbase" : {
                  "regionserver" : {
                    "readRequestsCount" : 1.0
                  }
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 0, 'dev02.hortonworks.com': 1},
        m: 'Two host_components'
      },
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "hbase" : {
                  "regionserver" : {
                    "readRequestsCount" : 0.0
                  }
                }
              }
            },
            {
              "HostRoles" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "hbase" : {
                  "regionserver" : {

                  }
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 0},
        m: 'Two host_components, one without metric'
      }
    ];

    describe('#metricMapper()', function() {
      var mainChartHeatmapHbaseMetrics = App.MainChartHeatmapHbaseMetrics.create();
      mainChartHeatmapHbaseMetrics.set('defaultMetric', 'metrics.hbase.regionserver.readRequestsCount');

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = mainChartHeatmapHbaseMetrics.metricMapper(test.json);
          expect(r).to.eql(test.result);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_memoryused_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_memoryused');

  describe('App.MainChartHeatmapMemoryUsedMetric', function () {

    var tests = [
      {
        json:{
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "memory" : {
                  "mem_buffers" : 109888.0,
                  "mem_cached" : 1965624.0,
                  "mem_free" : 261632.0,
                  "mem_shared" : 0.0,
                  "mem_total" : 6123776.0,
                  "swap_free" : 4126820.0,
                  "swap_total" : 4128760.0
                }
              }
            }
          ]
        },
        m: 'One host',
        e: {'dev01.hortonworks.com': '63.6'}
      },
      {
        json:{
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "memory" : {
                  "mem_buffers" : 109888.0,
                  "mem_cached" : 1965624.0,
                  "mem_free" : 261632.0,
                  "mem_shared" : 0.0,
                  "mem_total" : 6123776.0,
                  "swap_free" : 4126820.0,
                  "swap_total" : 4128760.0
                }
              }
            },
            {
              "Hosts" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "memory" : {
                  "mem_buffers" : 109888.0,
                  "mem_cached" : 1965624.0,
                  "mem_free" : 261632.0,
                  "mem_shared" : 0.0,
                  "mem_total" : 6123776.0,
                  "swap_free" : 4126820.0,
                  "swap_total" : 4128760.0
                }
              }
            }
          ]
        },
        m: 'Two hosts',
        e: {'dev01.hortonworks.com': '63.6', 'dev02.hortonworks.com': '63.6'}
      },
      {
        json:{
          "items" : [
            {
              "Hosts" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "memory" : {
                  "mem_buffers" : 109888.0,
                  "mem_cached" : 1965624.0,
                  "mem_free" : 261632.0,
                  "mem_shared" : 0.0,
                  "mem_total" : 6123776.0,
                  "swap_free" : 4126820.0,
                  "swap_total" : 4128760.0
                }
              }
            },
            {
              "Hosts" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {

              }
            }
          ]
        },
        m: 'Two hosts, One without metric',
        e: {'dev01.hortonworks.com': '63.6'}
      }
    ];

    describe('#metricMapper()', function() {
      var mainChartHeatmapMemoryUsedMetric = App.MainChartHeatmapMemoryUsedMetric.create();

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = mainChartHeatmapMemoryUsedMetric.metricMapper(test.json);
          expect(r).to.eql(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');

  describe('MainChartHeatmapMetric', function () {

    var mainChartHeatmapMetric = App.MainChartHeatmapMetric.create({});

    describe('#formatLegendNumber', function () {
      var tests = [
        {m:'undefined to undefined',i:undefined,e:undefined},
        {m:'0 to 0',i:0,e:0},
        {m:'1 to 1',i:1,e:1},
        {m:'1.23 to 1.2',i:1.23,e:1.2}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(mainChartHeatmapMetric.formatLegendNumber(test.i)).to.equal(test.e);
        });
      });
      it('NaN to NaN' + ' ', function () {
        expect(isNaN(mainChartHeatmapMetric.formatLegendNumber(NaN))).to.equal(true);
      });
    });

    describe('#refreshHostSlots', function() {
      beforeEach(function() {
        App.set('apiPrefix', '/api/v1');
        App.set('clusterName', 'tdk');
        App.testMode = false;
        sinon.spy($, 'ajax');
      });

      afterEach(function() {
        $.ajax.restore();
        App.testMode = true;
      });

      mainChartHeatmapMetric  = App.MainChartHeatmapMetric.create({});
      mainChartHeatmapMetric.set('ajaxIndex', 'hosts.metrics.host_component');
      mainChartHeatmapMetric.set('ajaxData', {
        serviceName: 'SERVICE',
        componentName: 'COMPONENT'
      });
      mainChartHeatmapMetric.set('defaultMetric', 'default.metric');

      it('Should load proper URL', function() {
        mainChartHeatmapMetric.refreshHostSlots();
        expect($.ajax.args[0][0].url.endsWith('/api/v1/clusters/tdk/services/SERVICE/components/COMPONENT?fields=host_components/default/metric')).to.equal(true);
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_yarn_ResourceUsed_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_yarn');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_yarn_ResourceUsed');

  describe('App.MainChartHeatmapYarnResourceUsedMetric', function () {

    var mainChartHeatmapYarnResourceUsedMetric = App.MainChartHeatmapYarnResourceUsedMetric.create({});

    describe('#metricMapper', function () {
      var tests = [
        {
          m: 'Correct JSON #1',
          i: {
            "ServiceComponentInfo" : {
              "rm_metrics" : {
                "cluster" : {
                  "nodeManagers" : "[{\"HostName\":\"dev01.hortonworks.com\",\"Rack\":\"/default-rack\",\"State\":\"RUNNING\",\"NodeId\":\"dev01.hortonworks.com:45454\",\"NodeHTTPAddress\":\"dev01.hortonworks.com:8042\",\"LastHealthUpdate\":1375869232870,\"HealthReport\":\"\",\"NumContainers\":0,\"UsedMemoryMB\":10,\"AvailableMemoryMB\":100}]"
                }
              }
            }
          },
          e: {
            length: 1,
            val: '10.0',
            host: 'dev01.hortonworks.com'
          }
        },
        {
          m: 'Correct JSON #2',
          i: {
            "ServiceComponentInfo" : {
              "rm_metrics" : {
                "cluster" : {
                  "nodeManagers" : "[{\"HostName\":\"dev01.hortonworks.com\",\"Rack\":\"/default-rack\",\"State\":\"RUNNING\",\"NodeId\":\"dev01.hortonworks.com:45454\",\"NodeHTTPAddress\":\"dev01.hortonworks.com:8042\",\"LastHealthUpdate\":1375869232870,\"HealthReport\":\"\",\"NumContainers\":0,\"UsedMemoryMB\":0,\"AvailableMemoryMB\":100}]"
                }
              }
            }
          },
          e: {
            length: 1,
            val: '0.0',
            host: 'dev01.hortonworks.com'
          }
        },
        {
          m: 'JSON without "cluster"',
          i: {
            "ServiceComponentInfo" : {
              "rm_metrics" : {
              }
            }
          },
          e: {
            length: 0,
            val: null,
            host: null
          }
        },
        {
          m: 'JSON without "nodeManagers"',
          i: {
            "ServiceComponentInfo" : {
              "rm_metrics" : {
                "cluster" : {
                }
              }
            }
          },
          e: {
            length: 0,
            val: null,
            host: null
          }
        },
        {
          m: 'Correct JSON #3 (with two nodeManagers)',
          i: {
            "ServiceComponentInfo" : {
              "rm_metrics" : {
                "cluster" : {
                  "nodeManagers" : "[{\"HostName\":\"dev01.hortonworks.com\",\"Rack\":\"/default-rack\",\"State\":\"RUNNING\",\"NodeId\":\"dev01.hortonworks.com:45454\",\"NodeHTTPAddress\":\"dev01.hortonworks.com:8042\",\"LastHealthUpdate\":1375869232870,\"HealthReport\":\"\",\"NumContainers\":0,\"UsedMemoryMB\":0,\"AvailableMemoryMB\":100}, {\"HostName\":\"dev02.hortonworks.com\",\"Rack\":\"/default-rack\",\"State\":\"RUNNING\",\"NodeId\":\"dev02.hortonworks.com:45454\",\"NodeHTTPAddress\":\"dev01.hortonworks.com:8042\",\"LastHealthUpdate\":1375869232870,\"HealthReport\":\"\",\"NumContainers\":0,\"UsedMemoryMB\":100,\"AvailableMemoryMB\":100}]"
                }
              }
            }
          },
          e: {
            length: 2,
            val: '100.0',
            host: 'dev02.hortonworks.com'
          }
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function () {
          var result = mainChartHeatmapYarnResourceUsedMetric.metricMapper(test.i);
          var length = 0;
          for(var p in result) {
            if (result.hasOwnProperty(p)) {
              length++;
            }
          }
          expect(length).to.equal(test.e.length);
          if (test.e.host) {
            expect(result.hasOwnProperty(test.e.host)).to.equal(true);
            expect(result[test.e.host]).to.equal(test.e.val);
          }
        });
      });
    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_metrics/heatmap_metric_yarn_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('messages');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric');
  require('controllers/main/charts/heatmap_metrics/heatmap_metric_yarn');

  describe('App.MainChartHeatmapYarnMetrics', function () {

    var tests = [
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "memHeapUsedM" : 10
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 10},
        m: 'One host_component'
      },
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "memHeapUsedM" : 10
                }
              }
            },
            {
              "HostRoles" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "memHeapUsedM" : 20
                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 10, 'dev02.hortonworks.com': 20},
        m: 'Two host_components'
      },
      {
        json: {
          "host_components" : [
            {
              "HostRoles" : {
                "host_name" : "dev01.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {
                  "memHeapUsedM" : 10
                }
              }
            },
            {
              "HostRoles" : {
                "host_name" : "dev02.hortonworks.com"
              },
              "metrics" : {
                "jvm" : {

                }
              }
            }
          ]
        },
        result: {'dev01.hortonworks.com': 10},
        m: 'Two host_components, one without metric'
      }
    ];

    describe('#metricMapper()', function() {
      var mainChartHeatmapYarnMetrics = App.MainChartHeatmapYarnMetrics.create();
      mainChartHeatmapYarnMetrics.set('defaultMetric', 'metrics.jvm.memHeapUsedM');

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = mainChartHeatmapYarnMetrics.metricMapper(test.json);
          expect(r).to.eql(test.result);
        });
      });

    });

  });
  
});
window.require.register("test/controllers/main/charts/heatmap_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('models/rack');
  require('controllers/main/charts/heatmap');

  describe('MainChartsHeatmapController', function () {

    describe('#validation()', function () {
      var controller = App.MainChartsHeatmapController.create({
        allMetrics: [],
        selectedMetric: Ember.Object.create({maximumValue: 100})
      });
      it('should set maximumValue if inputMaximum consists only of digits', function () {
        controller.set("inputMaximum", 5);
        expect(controller.get('selectedMetric.maximumValue')).to.equal(5);
      });
      it('should not set maximumValue if inputMaximum consists not only of digits', function () {
        controller.set("inputMaximum", 'qwerty');
        expect(controller.get('selectedMetric.maximumValue')).to.equal(5);
      });
      it('should not set maximumValue if inputMaximum consists not only of digits', function () {
        controller.set("inputMaximum", '100%');
        expect(controller.get('selectedMetric.maximumValue')).to.equal(5);
      });
      it('should set maximumValue if inputMaximum consists only of digits', function () {
        controller.set("inputMaximum", 1000);
        expect(controller.get('selectedMetric.maximumValue')).to.equal(1000);
      })
    });

    describe('#showHeatMapMetric()', function () {
      var controller = App.MainChartsHeatmapController.create({
        allMetrics: [],
        selectedMetric: Ember.Object.create({maximumValue: 100}),
        loadMetrics: function () {
        }
      });
      controller.set("selectedMetric", 100);
      it('should not set selectedMetric event.context if it is not defined', function () {
        controller.showHeatMapMetric({});
        expect(controller.get('selectedMetric')).to.equal(100);
      });
      it('should set selectedMetric event.context if it is defined', function () {
        controller.showHeatMapMetric({context: 5});
        expect(controller.get('selectedMetric')).to.equal(5);
      });
    });

    describe('#loadMetrics()', function () {
      var controller = App.MainChartsHeatmapController.create({
        testPassed: false,
        allMetrics: [],
        inputMaximum: 10
      });
      controller.set('selectedMetric', Ember.Object.create({
        maximumValue: 100,
        refreshHostSlots: function () {
          controller.set('testPassed', true);
        }
      }));
      controller.loadMetrics();
      it('should set inputMaximum as selectedMetric.maximumValue', function () {
        expect(controller.get('inputMaximum')).to.equal(100);
      });
      it('should call refreshHostSlots from selectedMetric', function () {
        expect(controller.get('testPassed')).to.equal(true);
      });
    });

    describe('#rackClass', function () {
      var controller = App.MainChartsHeatmapController.create({
        allMetrics: [],
        racks: [1]
      });
      it('should return "span12" for 1 cluster rack', function () {
        expect(controller.get('rackClass')).to.equal('span12');
      });
      it('should return "span6" for 2 cluster racks', function () {
        controller.set('racks', [1, 2]);
        expect(controller.get('rackClass')).to.equal('span6');
      });
      it('should return "span4" for 3 cluster racks', function () {
        controller.set('racks', [1, 2, 3]);
        expect(controller.get('rackClass')).to.equal('span4');
      });
    });
  });

  
});
window.require.register("test/controllers/main/dashboard_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /*
  var App = require('app');

  require('models/alert'); 
  App.Alert.FIXTURES = [{ status: 'ok' }, { status: 'corrupt' }, { status: 'corrupt',}];
  require('controllers/main/dashboard');
   
  describe('MainDashboard', function () {
   
    var controller = App.MainDashboardController.create();
    
    describe('#alertsCount', function () {
      it('should return 2 if 2 alerts has status corrupt', function () {
          expect(controller.get('alertsCount')).to.equal(2);
      })
    })
  })
  */
});
window.require.register("test/controllers/main/host_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  var validator = require('utils/validator');
  require('utils/component');
  require('utils/batch_scheduled_requests');
  require('controllers/main/host');
  require('mappers/server_data_mapper');

  describe('MainHostController', function () {

    var hostController;

    describe('#bulkOperation', function() {

      beforeEach(function() {
        hostController = App.MainHostController.create({
          bulkOperationForHostsRestart: function(){},
          bulkOperationForHosts: function(){},
          bulkOperationForHostComponentsRestart: function(){},
          bulkOperationForHostComponentsDecommission: function(){},
          bulkOperationForHostComponents: function(){},
          bulkOperationForHostsPassiveState: function(){}
        });
        sinon.spy(hostController, 'bulkOperationForHostsRestart');
        sinon.spy(hostController, 'bulkOperationForHosts');
        sinon.spy(hostController, 'bulkOperationForHostComponentsRestart');
        sinon.spy(hostController, 'bulkOperationForHostComponentsDecommission');
        sinon.spy(hostController, 'bulkOperationForHostComponents');
        sinon.spy(hostController, 'bulkOperationForHostsPassiveState');
      });

      afterEach(function() {
        hostController.bulkOperationForHosts.restore();
        hostController.bulkOperationForHostsRestart.restore();
        hostController.bulkOperationForHostComponentsRestart.restore();
        hostController.bulkOperationForHostComponentsDecommission.restore();
        hostController.bulkOperationForHostComponents.restore();
        hostController.bulkOperationForHostsPassiveState.restore();

      });

      it('RESTART for hosts', function() {
        var operationData = {
          action: 'RESTART'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostsRestart.calledOnce).to.equal(true);
      });

      it('START for hosts', function() {
        var operationData = {
          action: 'STARTED'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHosts.calledOnce).to.equal(true);
      });

      it('STOP for hosts', function() {
        var operationData = {
          action: 'INSTALLED'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHosts.calledOnce).to.equal(true);
      });

      it('PASSIVE_STATE for hosts', function() {
        var operationData = {
          action: 'PASSIVE_STATE'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostsPassiveState.calledOnce).to.equal(true);
      });

      it('RESTART for hostComponents', function() {
        var operationData = {
          action: 'RESTART',
          componentNameFormatted: 'DataNodes'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostComponentsRestart.calledOnce).to.equal(true);
      });

      it('START for hostComponents', function() {
        var operationData = {
          action: 'STARTED',
          componentNameFormatted: 'DataNodes'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostComponents.calledOnce).to.equal(true);
      });

      it('STOP for hostComponents', function() {
        var operationData = {
          action: 'INSTALLED',
          componentNameFormatted: 'DataNodes'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostComponents.calledOnce).to.equal(true);
      });

      it('DECOMMISSION for hostComponents', function() {
        var operationData = {
          action: 'DECOMMISSION',
          componentNameFormatted: 'DataNodes'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostComponentsDecommission.calledOnce).to.equal(true);
      });

      it('RECOMMISSION for hostComponents', function() {
        var operationData = {
          action: 'DECOMMISSION_OFF',
          componentNameFormatted: 'DataNodes'
        };
        hostController.bulkOperation(operationData, []);
        expect(hostController.bulkOperationForHostComponentsDecommission.calledOnce).to.equal(true);
      });

    });

    describe('#bulkOperationForHosts', function() {

      beforeEach(function(){
        hostController = App.MainHostController.create({});
        sinon.spy($, 'ajax');
      });

      afterEach(function() {
        $.ajax.restore();
      });

      var tests = [
        {
          operationData: {},
          hosts: [],
          m: 'no hosts',
          e: false
        },
        {
          operationData: {
            actionToCheck: 'STARTED'
          },
          hosts: [
            Em.Object.create({
              hostComponents: Em.A([
                Em.Object.create({isMaster: true, isSlave: false, host: {hostName:'host1'}, workStatus: 'STARTED', componentName: 'NAMENODE', passiveState: 'OFF'}),
                Em.Object.create({isMaster: false, isSlave: true, host: {hostName:'host1'}, workStatus: 'STARTED', componentName: 'DATANODE', passiveState: 'OFF'})
              ])
            })
          ],
          m: '1 host. components are in proper state',
          e: true
        },
        {
          operationData: {
            actionToCheck: 'INSTALLED'
          },
          hosts: [
            Em.Object.create({
              hostComponents: Em.A([
                Em.Object.create({isMaster: true, isSlave: false, host: {hostName:'host1'}, workStatus: 'STARTED', componentName: 'NAMENODE', passiveState: 'OFF'}),
                Em.Object.create({isMaster: false, isSlave: true, host: {hostName:'host1'}, workStatus: 'STARTED', componentName: 'DATANODE', passiveState: 'OFF'})
              ])
            })
          ],
          m: '1 host. components are not in proper state',
          e: false
        },
        {
          operationData: {
            actionToCheck: 'INSTALLED'
          },
          hosts: [
            Em.Object.create({
              hostComponents: Em.A([
                Em.Object.create({isMaster: true, isSlave: false, host: {hostName:'host1'}, workStatus: 'INSTALLED', componentName: 'NAMENODE', passiveState: 'OFF'}),
                Em.Object.create({isMaster: false, isSlave: true, host: {hostName:'host1'}, workStatus: 'STARTED', componentName: 'DATANODE', passiveState: 'OFF'})
              ])
            })
          ],
          m: '1 host. some components are in proper state',
          e: true
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          hostController.bulkOperationForHosts(test.operationData, test.hosts);
          expect($.ajax.called).to.equal(test.e);
        });
      });

    });

    describe('#bulkOperationForHostsRestart', function() {

      beforeEach(function(){
        hostController = App.MainHostController.create({});
        sinon.spy($, 'ajax');
      });

      afterEach(function() {
        $.ajax.restore();
      });

      var tests = Em.A([
        {
          hosts: Em.A([]),
          m: 'No hosts',
          e: false
        },
        {
          hosts: Em.A([
            Em.Object.create({
              hostComponents: Em.A([Em.Object.create({passiveState: 'OFF'}), Em.Object.create({passiveState: 'OFF'})])
            })
          ]),
          m: 'One host',
          e: true
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          hostController.bulkOperationForHostsRestart({}, test.hosts);
          expect($.ajax.calledOnce).to.equal(test.e)
        });
      });

    });

    describe('#bulkOperationForHostsPassiveState', function() {

      beforeEach(function(){
        hostController = App.MainHostController.create({});
        sinon.spy($, 'ajax');
      });

      afterEach(function() {
        $.ajax.restore();
      });

      var tests = [
        {
          hosts: Em.A([]),
          operationData: {},
          m: 'No hosts',
          e: false
        },
        {
          hosts: Em.A([
            Em.Object.create({
              passiveState: 'OFF'
            })
          ]),
          operationData: {
            state: 'OFF'
          },
          m: 'One host, but in state that should get',
          e: false
        },
        {
          hosts: Em.A([
            Em.Object.create({
              passiveState: 'OFF'
            })
          ]),
          operationData: {
            state: 'ON'
          },
          m: 'One host with proper state',
          e: true
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          hostController.bulkOperationForHostsPassiveState(test.operationData, test.hosts);
          expect($.ajax.calledOnce).to.equal(test.e)
        });
      });

    });

  });
});
window.require.register("test/controllers/main/item_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  /*
  var App = require('app');
  require('views/common/modal_popup');
  require('controllers/main/service/item');

  describe('App.MainServiceItemController', function () {

      describe('#showRebalancer', function () {
          it('should return true if serviceName is hdfs', function () {
              var mainServiceItemController = App.MainServiceItemController.create({
              });
              mainServiceItemController.content.set('serviceName', 'hdfs');
              expect(mainServiceItemController.get('showRebalancer')).to.equal(true);
          })
      })
  })
  */
  
});
window.require.register("test/controllers/main/service/add_controller_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('controllers/wizard');
  require('controllers/main/service/add_controller');

  describe('App.AddServiceController', function() {

    describe('#isServiceConfigurable', function() {
      var tests = [
        {
          services: [
            {serviceName: 'HDFS'},
            {serviceName: 'MAPREDUCE'},
            {serviceName: 'NAGIOS'}
          ],
          service: 'HDFS',
          m: 'Service is configurable',
          e: true
        },
        {
          services: [
            {serviceName: 'HDFS'},
            {serviceName: 'MAPREDUCE'},
            {serviceName: 'NAGIOS'}
          ],
          service: 'PIG',
          m: 'Service is not configurable',
          e: false
        },
        {
          services: [],
          service: 'HDFS',
          m: 'No services',
          e: false
        }
      ];
      tests.forEach(function(test) {
        var controller = App.AddServiceController.create({serviceConfigs: test.services});
        it('', function() {
          expect(controller.isServiceConfigurable(test.service)).to.equal(test.e);
        });
      });
    });

    describe('#skipConfigStep', function() {
      var tests = [
        {
          content: {
            services:[
              {serviceName: 'HDFS', isInstalled: true, isSelected: true},
              {serviceName: 'PIG', isInstalled: false, isSelected: true},
              {serviceName: 'MAPREDUCE', isInstalled: true, isSelected: true}
            ]
          },
          serviceConfigs: [
            {serviceName: 'HDFS'},
            {serviceName: 'MAPREDUCE'},
            {serviceName: 'NAGIOS'}
          ],
          m: '2 installed services and 1 new that can\'t be configured',
          e: true
        },
        {
          content: {
            services:[
              {serviceName: 'HDFS', isInstalled: true, isSelected: true},
              {serviceName: 'NAGIOS', isInstalled: false, isSelected: true},
              {serviceName: 'MAPREDUCE', isInstalled: true, isSelected: true}
            ]
          },
          serviceConfigs: [
            {serviceName: 'HDFS'},
            {serviceName: 'MAPREDUCE'},
            {serviceName: 'NAGIOS'}
          ],
          m: '2 installed services and 1 new that can be configured',
          e: false
        },
        {
          content: {
            services:[
              {serviceName: 'HDFS', isInstalled: true, isSelected: true},
              {serviceName: 'PIG', isInstalled: false, isSelected: true},
              {serviceName: 'SQOOP', isInstalled: false, isSelected: true},
              {serviceName: 'MAPREDUCE', isInstalled: true, isSelected: true}
            ]
          },
          serviceConfigs: [
            {serviceName: 'HDFS'},
            {serviceName: 'MAPREDUCE'},
            {serviceName: 'NAGIOS'}
          ],
          m: '2 installed services and 2 new that can\'t be configured',
          e: true
        }
      ];
      tests.forEach(function(test) {
        var controller = App.AddServiceController.create({content:{services: test.content.services}, serviceConfigs: test.serviceConfigs});
        it(test.m, function() {
          expect(controller.skipConfigStep()).to.equal(test.e);
        })
      });
    });

  });
  
});
window.require.register("test/controllers/main/service/reassign_controller_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/cluster');
  require('controllers/wizard');
  require('controllers/main/service/reassign_controller');

  describe('App.ReassignMasterController', function () {

    var reassignMasterController = App.ReassignMasterController.create({});

    describe('#totalSteps', function () {
      it('check', function () {
        expect(reassignMasterController.get('totalSteps')).to.equal(6);
      });
    });

    reassignMasterController.set('content.reassign', {service_id:null});

  });
  
});
window.require.register("test/controllers/main/service_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('controllers/main/service');

  var mainServiceController;

  describe('App.MainServiceController', function () {

    var tests = Em.A([
      {
        isStartStopAllClicked: false,
        content: Em.A([
          Em.Object.create({
            healthStatus: 'green',
            serviceName: 'HIVE',
            isClientsOnly: false
          }),
          Em.Object.create({
            healthStatus: 'green',
            serviceName: 'HDFS',
            isClientsOnly: false
          }),
          Em.Object.create({
            healthStatus: 'red',
            serviceName: 'TEZ',
            isClientsOnly: true
          })
        ]),
        eStart: true,
        eStop: false,
        mStart: 'mainServiceController StartAll is Disabled 1',
        mStop: 'mainServiceController StopAll is Enabled 1'
      },
      {
        isStartStopAllClicked: true,
        content: Em.A([
          Em.Object.create({
            healthStatus: 'red',
            serviceName: 'HIVE',
            isClientsOnly: false
          }),
          Em.Object.create({
            healthStatus: 'red',
            serviceName: 'HDFS',
            isClientsOnly: false
          }),
          Em.Object.create({
            healthStatus: 'red',
            serviceName: 'TEZ',
            isClientsOnly: true
          })
        ]),
        eStart: true,
        eStop: true,
        mStart: 'mainServiceController StartAll is Disabled 2',
        mStop: 'mainServiceController StopAll is Disabled 2'
      },
      {
        isStartStopAllClicked: false,
        content: Em.A([
          Em.Object.create({
            healthStatus: 'green',
            serviceName: 'HIVE',
            isClientsOnly: false
          }),
          Em.Object.create({
            healthStatus: 'red',
            serviceName: 'HDFS',
            isClientsOnly: false
          }),
          Em.Object.create({
            healthStatus: 'red',
            serviceName: 'TEZ',
            isClientsOnly: true
          })
        ]),
        eStart: false,
        eStop: false,
        mStart: 'mainServiceController StartAll is Enabled 3',
        mStop: 'mainServiceController StopAll is Enabled 3'
      }

    ]);
    describe('#isStartAllDisabled', function () {
      tests.forEach(function (test) {
        it(test.mStart, function () {
          mainServiceController = App.MainServiceController.create({
            content: test.content,
            isStartStopAllClicked: test.isStartStopAllClicked
          });
          expect(mainServiceController.get('isStartAllDisabled')).to.equals(test.eStart);
        });
      });
    });

    describe('#isStopAllDisabled', function () {
      tests.forEach(function (test) {
        it(test.mStop, function () {
          mainServiceController = App.MainServiceController.create({
            content: test.content,
            isStartStopAllClicked: test.isStartStopAllClicked
          });
          expect(mainServiceController.get('isStopAllDisabled')).to.equals(test.eStop);
        });
      });
    });
  });
  
});
window.require.register("test/controllers/wizard/stack_upgrade/step3_controller_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  var Ember = require('ember');

  require('models/host');
  require('controllers/wizard/stack_upgrade/step3_controller');

  App.router = Ember.Object.create({
    stackUpgradeController: Ember.Object.create({
      save: function(val) {}
    })
  });

  describe('App.StackUpgradeStep3Controller', function() {

    var stackUpgradeStep3Controller = App.StackUpgradeStep3Controller.create();

    describe('#runUpgradeErrorCallback', function() {
      var processes = [
        Ember.Object.create({
          status: '',
          isRetry: false,
          name: 'UPGRADE_SERVICES'
        })
      ];

      stackUpgradeStep3Controller.set('processes', processes);
      stackUpgradeStep3Controller.set('content', {cluster: {}, controllerName:'stackUpgradeController'});

      it('check process condition', function() {
        App.testMode = true;
        stackUpgradeStep3Controller.runUpgradeErrorCallback();
        expect(stackUpgradeStep3Controller.get('processes').findProperty('name', 'UPGRADE_SERVICES').get('status')).to.equal('FAILED');
        expect(stackUpgradeStep3Controller.get('processes').findProperty('name', 'UPGRADE_SERVICES').get('isRetry')).to.equal(true);
        expect(stackUpgradeStep3Controller.get('submitButton')).to.equal(false);
        App.testMode = false;
      });
    });

  });
  
});
window.require.register("test/controllers/wizard_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/cluster');
  require('controllers/wizard');

  describe('App.WizardController', function () {

    var wizardController = App.WizardController.create({});

    var totalSteps = 11;
    var ruller = [];
    for(var i = 0; i < totalSteps; i++) {
      ruller.push(i);
    }

    describe('#setLowerStepsDisable', function() {
      for(var i = 1; i < totalSteps; i++) {
        var indx = i;
        var steps = [];
        for(var j = 1; j <= indx; j++) {
          steps.push(Em.Object.create({step:j,value:false}));
        }
        wizardController.set('isStepDisabled', steps);
        for(j = 1; j <= indx; j++) {
          it('Steps: ' + i + ' | Disabled: ' + (j-1), function() {
            wizardController.setLowerStepsDisable(j);
            expect(wizardController.get('isStepDisabled').filterProperty('value', true).length).to.equal(j-1);
          });
        }
      }
    });

    // isStep0 ... isStep10 tests
    App.WizardController1 = App.WizardController.extend({currentStep:''});
    var tests = [];
    for(var i = 0; i < totalSteps; i++) {
      var n = ruller.slice(0);
      n.splice(i,1);
      tests.push({i:i,n:n});
    }
    tests.forEach(function(test) {
      describe('isStep'+test.i, function() {
        var w = App.WizardController1.create();
        w.set('currentStep', test.i);
        it('Current Step is ' + test.i + ', so isStep' + test.i + ' is TRUE', function() {
          expect(w.get('isStep'+ test.i)).to.equal(true);
        });
        test.n.forEach(function(indx) {
          it('Current Step is ' + test.i + ', so isStep' + indx + ' is FALSE', function() {
            expect(w.get('isStep'+ indx)).to.equal(false);
          });
        });
      });
    });
    // isStep0 ... isStep10 tests end

    describe('#gotoStep', function() {
      var w = App.WizardController1.create();
      var steps = [];
      for(var j = 0; j < totalSteps; j++) {
        steps.push(Em.Object.create({step:j,value:false}));
      }
      steps.forEach(function(step, index) {
        step.set('value', true);
        w.set('isStepDisabled', steps);
        it('step ' + index + ' is disabled, so gotoStep('+index+') is not possible', function() {
          expect(w.gotoStep(index)).to.equal(false);
        });
      });
    });

    describe('#launchBootstrapSuccessCallback', function() {
      it('Save bootstrapRequestId', function() {
        var data = {requestId:123};
        wizardController.launchBootstrapSuccessCallback(data);
        expect(wizardController.get('bootstrapRequestId')).to.equal(data.requestId);
      });
    });

  });
  
});
window.require.register("test/data/HDP2/site_properties_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('utils/helper');
  var siteProperties = require('data/HDP2/site_properties').configProperties;

  describe('hdp2SiteProperties', function () {


    //@TODO: log4j propeties should not be a part of site properties file. A separate file  should address this logic. site_properties.js should be used only to provide ui attributes to existing stack properties
    //Exclude log4j properties from unit tests for now
    siteProperties = siteProperties.filter(function(item, index){
      return !(item.filename && item.filename.endsWith('log4j.xml'));
    });
    // No site properties should be made invisible
    siteProperties.forEach(function(siteProperty){
      it('Check invisible attribute of "' + siteProperty.name  + '"' + '. It should not be defined ', function () {
        expect(siteProperty.isVisible).to.equal(undefined);
      });
    });

    // No site properties should have value and defaultValue defined on client side.
    // These should be always retrieved from server.

      siteProperties.forEach(function(siteProperty){
        it('Check value and defaultValue attribute of "' + siteProperty.name + '"' + '. It should not be defined ', function () {
          expect(siteProperty.value).to.equal(undefined);
          expect(siteProperty.defaultValue).to.equal(undefined);
      });
    });

    // No site properties should have description field duplicated on client side.
    // These should be always retrieved from server.
    siteProperties.forEach(function(siteProperty){
      it('Check description attribute of "' + siteProperty.name + '"' + '. It should not be defined ', function () {
        expect(siteProperty.description).to.equal(undefined);
      });
    });

    // All the site properties should be persisted in the configuration tag
    // So isRequiredByAgent should be never defined over here
    // These should be always retrieved from server and saved in the correct configuration resource via API.
    siteProperties.forEach(function(siteProperty){
      it('Check isRequiredByAgent attribute of "' + siteProperty.name + '"' + '. It should not be defined ', function () {
        expect(siteProperty.isRequiredByAgent).to.equal(undefined);
      });
    });

    // All Falcon site properties should be mapped to site file. There is a property with same name (*.domain)
    // in different site files of Falcon service

      var falconSiteProperties = siteProperties.filterProperty('serviceName','FALCON');
      falconSiteProperties.forEach(function(siteProperty){
        it('Check filename attribute for "' + siteProperty.name + '"' + ' property of Falcon service. It should be defined ', function () {
          expect(siteProperty).to.have.property('filename');
      });
    });

  });
});
window.require.register("test/installer/step0_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('controllers/wizard/step1_controller');

  /*describe('App.InstallerStep1Controller', function () {

    describe('#validateStep1()', function () {
      it('should return false and sets invalidClusterName to true if cluster name is empty', function () {
        var controller = App.InstallerStep1Controller.create();
        controller.set('clusterName', '');
        expect(controller.validateStep1()).to.equal(false);
        expect(controller.get('invalidClusterName')).to.equal(true);
      })
      it('should return false and sets invalidClusterName to true if cluster name has whitespaces', function () {
        var controller = App.InstallerStep1Controller.create();
        controller.set('clusterName', 'My Cluster');
        expect(controller.validateStep1()).to.equal(false);
        expect(controller.get('invalidClusterName')).to.equal(true);
      })
      it('should return false and sets invalidClusterName to true if cluster name has special characters', function () {
        var controller = App.InstallerStep1Controller.create();
        controller.set('clusterName', 'my-cluster');
        expect(controller.validateStep1()).to.equal(false);
        expect(controller.get('invalidClusterName')).to.equal(true);
      })
      it('should return true, sets invalidClusterName to false if cluster name is valid', function () {
        var controller = App.InstallerStep1Controller.create();
        var clusterName = 'mycluster1';
        controller.set('clusterName', clusterName);
        expect(controller.validateStep1()).to.equal(true);
        expect(controller.get('invalidClusterName')).to.equal(false);
      })
    })

  })*/

  require('controllers/wizard/step0_controller');

  describe('App.WizardStep0Controller', function () {

    var wizardStep0Controller = App.WizardStep0Controller.create();

    describe('#invalidClusterName', function () {
      it('should return true if no cluster name is present', function () {
        wizardStep0Controller.set('hasSubmitted', true);
        wizardStep0Controller.set('content', {'cluster':{'name':''}});
        expect(wizardStep0Controller.get('invalidClusterName')).to.equal(true);
      });
      it('should return true if cluster name contains white spaces', function () {
        wizardStep0Controller.set('hasSubmitted', true);
        wizardStep0Controller.set('content', {'cluster':{'name':'the cluster'}});
        expect(wizardStep0Controller.get('invalidClusterName')).to.equal(true);
      });
      it('should return true if cluster name contains special chars', function () {
        wizardStep0Controller.set('hasSubmitted', true);
        wizardStep0Controller.set('content', {'cluster':{'name':'$cluster'}});
        expect(wizardStep0Controller.get('invalidClusterName')).to.equal(true);
      })
    })
  });
});
window.require.register("test/installer/step10_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */



  var App = require('app');
  require('controllers/wizard/step10_controller');


  describe('App.WizardStep10Controller', function () {
    var controller = App.WizardStep10Controller.create();

    describe('#calculateInstallTime', function () {
      it('from "9.21" to 9 minutes 12 seconds', function () {
        expect(controller.calculateInstallTime('9.21')).to.eql({minutes: 9, seconds: 12});
      });
      it('from "0" to 0 minutes 0 seconds', function () {
        expect(controller.calculateInstallTime('0')).to.eql({minutes: 0, seconds: 0});
      });
      it('from "10" to 10 minutes 0 seconds', function () {
        expect(controller.calculateInstallTime('10')).to.eql({minutes: 10, seconds: 0});
      });
      it('from "0.5" to 0 minutes 30 seconds', function () {
        expect(controller.calculateInstallTime('0.5')).to.eql({minutes: 0, seconds: 30});
      });
    });
  });


  
});
window.require.register("test/installer/step2_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  var Ember = require('ember');
  require('controllers/wizard/step2_controller');
  require('models/host');
  require('models/host_component');
  require('messages');

  describe('App.WizardStep2Controller', function () {

    describe('#updateHostNameArr()', function () {

        var controller = App.WizardStep2Controller.create({
          hostNames: 'apache.ambari'
        });
        App.store.load(App.Host, {'host_name': 'apache.ambari', id: '1'});
        controller.updateHostNameArr();

        it('should push to hostNameArr only new host names', function(){
          expect(controller.get('hostNameArr').length).to.equal(0);
        });

        it('should push to inputtedAgainHostNames already installed host names', function(){
          expect(controller.get('inputtedAgainHostNames').length).to.equal(1);
        })
    });

    describe('#isAllHostNamesValid()', function () {

      var controller = App.WizardStep2Controller.create({
        hostNames: ''
      });

      it('should return true if all host names are valid', function(){
        controller.set('hostNames', 'amache.org ambari.com');
        expect(controller.isAllHostNamesValid()).to.equal(true);
      });

      var tests = [
        'hostname',
        '-hostname.com',
        'hostname-.com',
        'host_name.com',
        '123.123.123.123',
        'hostnamehostnamehostnamehostnamehostnamehostnamehostnamehostname.hostnamehostnamehostnamehostnamehostnamehostnamehostnamehostname.hostnamehostnamehostnamehostnamehostnamehostnamehostnamehostname.hostnamehostnamehostnamehostnamehostnamehostnamehostnamehostname',
        'hostnamehostnamehostnamehostnamehostnamehostnamehostnamehostnamehostname.hostname'
      ];
      tests.forEach(function (test) {
        it('should return false for invalid host names ' + test + ' ', function () {
          controller.set('hostNames', test);
          expect(controller.isAllHostNamesValid()).to.equal(false);
        });
      });
    });

    describe('#checkHostError()', function () {

      var controller = App.WizardStep2Controller.create();

      it('should set hostsError if hostNames is ""', function () {
        controller.set('content', {'installOptions': {'hostNames': ''}});
        controller.checkHostError();
        expect(controller.get('hostsError').length).to.be.above(2);
      });

      /*it('should set hostsError if hostNames is invalid', function () {
        controller.set('content', {'installOptions': {'hostNames': '@#$%'}});
        controller.checkHostError();
        expect(controller.get('hostsError').length).to.be.above(2);
      })*/

      it('should set hostsError to null if hostNames is valid', function () {
        controller.set('content', {'installOptions': {'hostNames': 'ambari'}});
        controller.checkHostError();
        expect(controller.get('hostsError')).to.equal(null);
      })
    });

    describe('#checkHostAfterSubmitHandler()', function () {

      it('should be called after changing hasSubmitted', function (done) {
        var controller = App.WizardStep2Controller.create({
          checkHostError: function () {
            done();
          }
        });
        controller.set('hasSubmitted', true);
      });

      it('should be called after changing hostNames', function (done) {
        var controller = App.WizardStep2Controller.create({
          hasSubmitted: true,
          checkHostError: function () {
            done();
          }
        });
        controller.set('content', {'installOptions': {'hostNames': 'ambari'}});
      })
    });

    describe('#sshKeyError', function () {

      var controller = App.WizardStep2Controller.create({
        manualInstall: false,
        sshKey: '',
        hasSubmitted: true
      });

      it('should return error message if hasSubmitted is true, manualInstall is false and sshKey is ""', function () {
        expect(controller.get('sshKeyError').length).to.be.above(2);
      });

      it('should return null if hasSubmitted is false', function () {
        controller.set('hasSubmitted', false);
        expect(controller.get('sshKeyError')).to.equal(null);
      })
    });

    describe('#getHostInfo()', function () {

      it('should return object with bootStatus, installType and name for every element in hostNameArr', function () {
        var controller = App.WizardStep2Controller.create({
          hostNameArr: ['apache', 'ambari'],
          installType: 'manualDriven'
        });

        var test = controller.getHostInfo();
        expect(test).to.eql({
          'apache':{'name':'apache', 'installType': 'manualDriven', 'bootStatus': 'PENDING'},
          'ambari':{'name':'ambari', 'installType': 'manualDriven', 'bootStatus': 'PENDING'}
        });
      })
    });

    describe('#setSshKey()', function () {

      it('should set content.installOptions.sshKey', function () {
        var controller = App.WizardStep2Controller.create({
         content: {'installOptions': {'sshKey': '111'}}
        });
        controller.setSshKey('222');
        expect(controller.get('content.installOptions.sshKey')).to.equal('222');
      })
    });

    describe('#evaluateStep()', function () {

      it('should return false if isSubmitDisabled is true', function () {
        var controller = App.WizardStep2Controller.create({
          hostNames: 'apache.ambari'
        });
        controller.set('isSubmitDisabled', true);
        expect(controller.evaluateStep()).to.equal(false);
      });

      it('should return false if hostsError is not empty', function () {
        var controller = App.WizardStep2Controller.create({
          hostNames: 'apache.ambari'
        });
        controller.set('hostsError', 'error');
        expect(controller.evaluateStep()).to.equal(false);
      });

      it('should return false if sshKeyError is not empty', function () {
        var controller = App.WizardStep2Controller.create({
          hostNames: 'apache.ambari'
        });
        controller.set('sshKeyError', 'error');
        expect(controller.evaluateStep()).to.equal(false);
      });

      it('should return false if hostNameArr is empty', function () {
        var controller = App.WizardStep2Controller.create({
          hostNames: ''
        });
        expect(controller.evaluateStep()).to.equal(false);
      });

      it('should return false if isPattern is false', function () {
        var controller = App.WizardStep2Controller.create({
          hostNames: 'apache.ambari',
          isPattern: false
        });
        expect(controller.evaluateStep()).to.equal(false);
      })
    });

    describe('#patternExpression()', function () {

      it('should parse hosts from pattern expression to hostNameArr', function () {
        var controller = App.WizardStep2Controller.create({
          hostNameArr: ['host[001-011]']
        });
        controller.patternExpression();
        var result = true;
        var hosts = controller.get('hostNameArr');
        for (var i = 1; i<12; i++) {
          var extra = (i.toString().length == 1) ? 0 : '';
          if (hosts[i-1] !== 'host0' + extra + i) {
            result = false;
          }
        }
        expect(result).to.equal(true);
      })
    });

    describe('#proceedNext()', function () {

      it('should call manualInstallPopup if manualInstall is true', function (done) {
        var controller = App.WizardStep2Controller.create({
          hostNames: '',
          manualInstall: true,
          manualInstallPopup: function () {
            done();
          }
        });
        controller.proceedNext(true);
      })
    });

    describe('#isSubmitDisabled', function () {

      var controller = App.WizardStep2Controller.create({
        hostsError: '',
        sshKeyError: ''
      });

      it('should return value if hostsError is not empty', function () {
        controller.set('hostsError', 'error');
        expect(controller.get('isSubmitDisabled').length).to.above(0);
      });

      it('should return value if sshKeyError is not empty', function () {
        controller.set('sshKeyError', 'error');
        controller.set('hostsError', '');
        expect(controller.get('isSubmitDisabled').length).to.above(0);
      })
    });

    /*describe('#saveHosts()', function () {
      var controller = App.WizardStep2Controller.create({
        hostNameArr: ['ambari']
      });
      controller.set('content', Ember.Object.create({'hosts':Ember.Object.create({})}));

      App.router = Ember.Object.create({
        send:function() {}
      });

      it('should set content.hosts', function () {
        controller.saveHosts();
        expect(controller.get('content.hosts')).to.not.be.empty;
      })
    })*/
  });
  
});
window.require.register("test/installer/step3_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var Ember = require('ember');
  var App = require('app');
  require('utils/http_client');
  require('models/host');
  require('controllers/wizard/step3_controller');

  describe('App.WizardStep3Controller', function () {

    describe('#getAllRegisteredHostsCallback', function () {
      it('One host is already in the cluster, one host is registered', function() {
        var controller = App.WizardStep3Controller.create({
          hostsInCluster: [{
            hostName: 'wst3_host1'
          }],
          bootHosts: [
            {name:'wst3_host1'},
            {name:'wst3_host2'}
          ]
        });
        var test_data = {
          items: [
            {
              Hosts: {
                host_name: 'wst3_host1'
              }
            },
            {
              Hosts: {
                host_name: 'wst3_host2'
              }
            },
            {
              Hosts: {
                host_name: 'wst3_host3'
              }
            }
          ]
        };
        controller.getAllRegisteredHostsCallback(test_data);
        expect(controller.get('hasMoreRegisteredHosts')).to.equal(true);
        expect(controller.get('registeredHosts').length).to.equal(1);
      });

      it('All hosts are new', function() {
        var controller = App.WizardStep3Controller.create({
          hostsInCluster: [{
            hostName: 'wst3_host1'
          }],
          bootHosts: [
            {name:'wst3_host3'},
            {name:'wst3_host4'}
          ]
        });
        var test_data = {
          items: [
            {
              Hosts: {
                host_name: 'wst3_host3'
              }
            },
            {
              Hosts: {
                host_name: 'wst3_host4'
              }
            }
          ]
        };
        controller.getAllRegisteredHostsCallback(test_data);
        expect(controller.get('hasMoreRegisteredHosts')).to.equal(false);
        expect(controller.get('registeredHosts')).to.equal('');
      });

      it('No new hosts', function() {
        var controller = App.WizardStep3Controller.create({
          hostsInCluster: [{
            hostName: 'wst3_host1'
          }],
          bootHosts: [
            {name:'wst3_host1'}
          ]
        });
        var test_data = {
          items: [
            {
              Hosts: {
                host_name: 'wst3_host1'
              }
            }
          ]
        };
        controller.getAllRegisteredHostsCallback(test_data);
        expect(controller.get('hasMoreRegisteredHosts')).to.equal(false);
        expect(controller.get('registeredHosts')).to.equal('');
      });

    });

    var tests = [
      {
        bootHosts: [
          Em.Object.create({name:'wst3_host1', bootStatus: 'REGISTERED', isChecked: false}),
          Em.Object.create({name:'wst3_host2', bootStatus: 'REGISTERING', isChecked: false})
        ],
        m: 'One registered, one registering',
        visibleHosts: {
          RUNNING: {
            e: 0
          },
          REGISTERING: {
            e: 1
          },
          REGISTERED: {
            e: 1
          },
          FAILED: {
            e: 0
          }
        },
        onAllChecked: {
          e: [true, true]
        }
      },
      {
        bootHosts: [
          Em.Object.create({name:'wst3_host1', bootStatus: 'REGISTERED', isChecked: false}),
          Em.Object.create({name:'wst3_host2', bootStatus: 'REGISTERED', isChecked: false})
        ],
        m: 'Two registered',
        visibleHosts: {
          RUNNING: {
            e: 0
          },
          REGISTERING: {
            e: 0
          },
          REGISTERED: {
            e: 2
          },
          FAILED: {
            e: 0
          }
        },
        onAllChecked: {
          e: [true, true]
        }
      },
      {
        bootHosts: [
          Em.Object.create({name:'wst3_host1', bootStatus: 'FAILED', isChecked: false}),
          Em.Object.create({name:'wst3_host2', bootStatus: 'REGISTERED', isChecked: false})
        ],
        m: 'One registered, one failed',
        visibleHosts: {
          RUNNING: {
            e: 0
          },
          REGISTERING: {
            e: 0
          },
          REGISTERED: {
            e: 1
          },
          FAILED: {
            e: 1
          }
        },
        onAllChecked: {
          e: [true, true]
        }
      },
      {
        bootHosts: [
          Em.Object.create({name:'wst3_host1', bootStatus: 'FAILED', isChecked: false}),
          Em.Object.create({name:'wst3_host2', bootStatus: 'FAILED', isChecked: false})
        ],
        m: 'Two failed',
        visibleHosts: {
          RUNNING: {
            e: 0
          },
          REGISTERING: {
            e: 0
          },
          REGISTERED: {
            e: 0
          },
          FAILED: {
            e: 2
          }
        },
        onAllChecked: {
          e: [true, true]
        }
      },
      {
        bootHosts: [
          Em.Object.create({name:'wst3_host1', bootStatus: 'REGISTERING', isChecked: false}),
          Em.Object.create({name:'wst3_host2', bootStatus: 'REGISTERING', isChecked: false})
        ],
        m: 'Two registering',
        visibleHosts: {
          RUNNING: {
            e: 0
          },
          REGISTERING: {
            e: 2
          },
          REGISTERED: {
            e: 0
          },
          FAILED: {
            e: 0
          }
        },
        onAllChecked: {
          e: [true, true]
        }
      }
    ];

    describe('#registrationTimeoutSecs', function() {
      it('Manual install', function() {
        var controller = App.WizardStep3Controller.create({
          content: {
            installOptions: {
              manualInstall: true
            }
          }
        });
        expect(controller.get('registrationTimeoutSecs')).to.equal(15);
      });
      it('Not manual install', function() {
        var controller = App.WizardStep3Controller.create({
          content: {
            installOptions: {
              manualInstall: false
            }
          }
        });
        expect(controller.get('registrationTimeoutSecs')).to.equal(120);
      });
    });

    describe('#isHostHaveWarnings', function() {
      var tests = [
        {
          warnings: [{},{}],
          m: 'Warnings exist',
          e: true
        },
        {
          warnings: [],
          m: 'Warnings don\'t exist',
          e: false
        }
      ];
      tests.forEach(function(test) {
        var controller = App.WizardStep3Controller.create();
        controller.set('warnings', test.warnings);
        it(test.m, function() {
          expect(controller.get('isHostHaveWarnings')).to.equal(test.e);
        });
      });
    });
  });
});
window.require.register("test/installer/step4_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');
  require('controllers/wizard/step4_controller');

  describe('App.WizardStep4Controller', function () {

    var services = [
      'HDFS', 'MAPREDUCE', 'NAGIOS', 'GANGLIA', 'OOZIE', 'HIVE', 'HBASE', 'PIG', 'SCOOP', 'ZOOKEEPER', 'HCATALOG',
      'WEBHCAT', 'YARN', 'MAPREDUCE2', 'FALCON', 'TEZ', 'STORM'
    ];

    var controller = App.WizardStep4Controller.create();
    services.forEach(function(serviceName, index){
      controller.pushObject(Ember.Object.create({
        'serviceName':serviceName, 'isSelected': true, 'canBeSelected': true, 'isInstalled': false, 'isDisabled': 'HDFS' === serviceName
      }));
    });

    describe('#isSubmitDisabled', function () {
      it('should return false if at least one selected service is not installed', function () {
        expect(controller.get('isSubmitDisabled')).to.equal(false);
      });
      it('should return true if all selected services are already installed', function () {
        controller.setEach('isInstalled', true);
        controller.findProperty('serviceName', 'HDFS').set('isSelected', false);
        expect(controller.get('isSubmitDisabled')).to.equal(true);
      });
    });

    describe('#isAll', function () {
      it('should return true if all services are selected', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', true);
        expect(controller.get('isAll')).to.equal(true);
      });

      it('should return false if at least one service is not selected', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', false);
        expect(controller.get('isAll')).to.equal(false);
      });
    });

    describe('#isMinimum', function () {
      it('should return true if there are no services selected, except disabled', function () {
        controller.setEach('isSelected', false);
        expect(controller.get('isMinimum')).to.equal(true);
      });

      it('should return false if at least one service is selected, except disabled', function () {
        controller.findProperty('serviceName', 'MAPREDUCE').set('isSelected', true);
        expect(controller.get('isMinimum')).to.equal(false);
      });
    });

    describe('#selectAll()', function () {
      it('should select all services', function () {
        controller.setEach('isSelected', false);
        controller.selectAll();
        expect(controller.filterProperty('canBeSelected', true).everyProperty('isSelected', true)).to.equal(true);
      });
    });

    describe('#selectMinimum()', function () {
      it('should set isSelected false for all not disabled services', function () {
        controller.setEach('isSelected', true);
        controller.selectMinimum();
        expect(controller.findProperty('serviceName', 'HDFS').get('isSelected')).to.equal(true);
        expect(controller.filterProperty('isDisabled', false).everyProperty('isSelected', false)).to.equal(true);
      });
    });

    describe('#needToAddMapReduce()', function () {
      it('should return true if Pig is selected and MapReduce is not selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'PIG').set('isSelected', true);
        expect(controller.needToAddMapReduce()).to.equal(true);
      });

      it('should return true if Oozie is selected and MapReduce is not selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'OOZIE').set('isSelected', true);
        expect(controller.needToAddMapReduce()).to.equal(true);
      });

      it('should return true if Hive is selected and MapReduce is not selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'HIVE').set('isSelected', true);
        expect(controller.needToAddMapReduce()).to.equal(true);
      });

      it('should return false if MapReduce is selected or Pig, Oozie and Hive are not selected', function () {
        controller.findProperty('serviceName', 'MAPREDUCE').set('isSelected', true);
        expect(controller.needToAddMapReduce()).to.equal(false);
        controller.setEach('isSelected', false);
        expect(controller.needToAddMapReduce()).to.equal(false);
      });
    });

    describe('#needToAddYarnMapReduce2()', function () {
      it('should return true if Pig is selected and YARN+MapReduce2 is not selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'PIG').set('isSelected', true);
        expect(controller.needToAddYarnMapReduce2()).to.equal(true);
      });

      it('should return true if Oozie is selected and YARN+MapReduce2 is not selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'OOZIE').set('isSelected', true);
        expect(controller.needToAddYarnMapReduce2()).to.equal(true);
      });

      it('should return true if Hive is selected and YARN+MapReduce2 is not selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'HIVE').set('isSelected', true);
        expect(controller.needToAddYarnMapReduce2()).to.equal(true);
      });

      it('should return false if YARN+MapReduce2 is selected or Pig, Oozie and Hive are not selected', function () {
        controller.findProperty('serviceName', 'YARN').set('isSelected', true);
        expect(controller.needToAddYarnMapReduce2()).to.equal(false);
        controller.setEach('isSelected', false);
        expect(controller.needToAddYarnMapReduce2()).to.equal(false);
      });
    });

    describe('#needToAddZooKeeper()', function () {
      beforeEach(function() {
        ajax_send = App.ajax.send;
        App.ajax.send = function() {};
      });

      afterEach(function() {
        App.ajax.send = ajax_send;
      });
      var originalStackVersion = App.get('currentStackVersion');

      it('should return false if ZOOKEEPER is selected and Hadoop version above 2', function () {
        App.set('currentStackVersion', 'HDP-2.1.1');
        controller.findProperty('serviceName', 'ZOOKEEPER').set('isSelected', true);
        expect(controller.needToAddZooKeeper()).to.equal(false);
      });
      it('should return true if ZOOKEEPER is not selected and Hadoop version above 2', function () {
        controller.findProperty('serviceName', 'ZOOKEEPER').set('isSelected', false);
        expect(controller.needToAddZooKeeper()).to.equal(true);
      });
      it('should return false if none of the HBASE, HIVE, WEBHCAT, STORM is selected and Hadoop version below 2', function () {
        App.set('currentStackVersion', 'HDP-1.3.0');
        expect(controller.needToAddZooKeeper()).to.equal(false);
      });
      it('should return true if HBASE is not selected and Hadoop version below 2', function () {
        controller.findProperty('serviceName', 'HBASE').set('isSelected', true);
        expect(controller.needToAddZooKeeper()).to.equal(true);
      });
      it('should return true if HBASE, HIVE, WEBHCAT, STORM are selected and Hadoop version below 2', function () {
        controller.findProperty('serviceName', 'HIVE').set('isSelected', true);
        controller.findProperty('serviceName', 'WEBHCAT').set('isSelected', true);
        controller.findProperty('serviceName', 'STORM').set('isSelected', true);
        expect(controller.needToAddZooKeeper()).to.equal(true);
        App.set('currentStackVersion', originalStackVersion);
      });
    });

    describe('#gangliaOrNagiosNotSelected()', function () {
      it('should return true if Nagios or Ganglia is not selected', function () {
        controller.setEach('isSelected', true);
        controller.findProperty('serviceName', 'NAGIOS').set('isSelected', false);
        expect(controller.gangliaOrNagiosNotSelected()).to.equal(true);
        controller.setEach('isSelected', true);
        controller.findProperty('serviceName', 'GANGLIA').set('isSelected', false);
        expect(controller.gangliaOrNagiosNotSelected()).to.equal(true);
      });

      it('should return false if Nagios and Ganglia is selected', function () {
        controller.setEach('isSelected', false);
        controller.findProperty('serviceName', 'GANGLIA').set('isSelected', true);
        controller.findProperty('serviceName', 'NAGIOS').set('isSelected', true);
        expect(controller.gangliaOrNagiosNotSelected()).to.equal(false);
      });
    });

    describe('#needToAddTez()', function () {
      it('should return false if YARN is present, but not selected', function () {
        controller.findProperty('serviceName', 'YARN').set('isSelected', false);
        expect(controller.needToAddTez()).to.equal(false);
      });
      it('should return true if YARN is selected', function () {
        controller.findProperty('serviceName', 'YARN').set('isSelected', true);
        expect(controller.needToAddTez()).to.equal(true);
      });
    });

    describe('#needToAddOozie()', function () {
      it('should return false if FALCON is present, but not selected', function () {
        controller.findProperty('serviceName', 'FALCON').set('isSelected', false);
        expect(controller.needToAddOozie()).to.equal(false);
      });
      it('should return true if FALCON is selected', function () {
        controller.findProperty('serviceName', 'FALCON').set('isSelected', true);
        expect(controller.needToAddOozie()).to.equal(true);
      });
    });

    describe('#noDFSs()', function () {
      it('should return true if HDFS is not selected and GLUSTERFS is absent', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', false);
        expect(controller.noDFSs()).to.equal(true);
      });
      it('should return false if HDFS is selected and GLUSTERFS is absent', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', true);
        expect(controller.noDFSs()).to.equal(false);
      });
      it('should return true if HDFS is not selected and GLUSTERFS is not selected, but present', function () {
        controller.pushObject(Ember.Object.create({
          'serviceName':'GLUSTERFS', 'isSelected': false, 'canBeSelected': true, 'isInstalled': false, 'isDisabled': false
        }));
        controller.findProperty('serviceName', 'HDFS').set('isSelected', false);
        expect(controller.noDFSs()).to.equal(true);
      });
      it('should return false if HDFS is not selected and GLUSTERFS is selected', function () {
        controller.findProperty('serviceName', 'GLUSTERFS').set('isSelected', true);
        expect(controller.noDFSs()).to.equal(false);
      });
    });

    describe('#multipleDFSs()', function () {
      it('should return true if HDFS is selected and GLUSTERFS is selected', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', true);
        controller.findProperty('serviceName', 'GLUSTERFS').set('isSelected', true);
        expect(controller.multipleDFSs()).to.equal(true);
      });
      it('should return false if HDFS is not selected and GLUSTERFS is selected', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', false);
        expect(controller.multipleDFSs()).to.equal(false);
      });
      it('should return false if HDFS is selected and GLUSTERFS is not selected', function () {
        controller.findProperty('serviceName', 'HDFS').set('isSelected', true);
        controller.findProperty('serviceName', 'GLUSTERFS').set('isSelected', false);
        expect(controller.multipleDFSs()).to.equal(false);
      });
    });

    describe('#checkDependencies()', function () {
      var testCases = [
        {
          title: 'should set HCATALOG and WEBHCAT isSelected to true when HIVE is selected',
          condition: {
            'HBASE': true,
            'ZOOKEEPER': true,
            'HIVE': true,
            'HCATALOG': true,
            'WEBHCAT': true
          },
          result: {
            'HCATALOG': true,
            'WEBHCAT': true
          }
        },
        {
          title: 'should set HCATALOG and WEBHCAT isSelected to false when HIVE is not selected',
          condition: {
            'HBASE': true,
            'ZOOKEEPER': true,
            'HIVE': false,
            'HCATALOG': true,
            'WEBHCAT': true
          },
          result: {
            'HCATALOG': false,
            'WEBHCAT': false
          }
        },
        {
          title: 'should set MAPREDUCE2 isSelected to true when YARN is selected',
          condition: {
            'HBASE': true,
            'ZOOKEEPER': true,
            'HIVE': false,
            'HCATALOG': true,
            'WEBHCAT': true,
            'YARN': true,
            'MAPREDUCE2': true
          },
          result: {
            'MAPREDUCE2': true,
            'HCATALOG': false,
            'WEBHCAT': false
          }
        },
        {
          title: 'should set MAPREDUCE2 isSelected to false when YARN is not selected',
          condition: {
            'HBASE': true,
            'ZOOKEEPER': true,
            'HIVE': true,
            'HCATALOG': true,
            'WEBHCAT': true,
            'YARN': false,
            'MAPREDUCE2': true
          },
          result: {
            'MAPREDUCE2': false,
            'HCATALOG': true,
            'WEBHCAT': true
          }
        }
      ];

      testCases.forEach(function(testCase){
        it(testCase.title, function () {
          controller.clear();
          for(var id in testCase.condition) {
            controller.pushObject(Ember.Object.create({
              'serviceName':id, 'isSelected': testCase.condition[id], 'canBeSelected': true, 'isInstalled': false
            }));
          }
          controller.checkDependencies();
          for(var service in testCase.result) {
            expect(controller.findProperty('serviceName', service).get('isSelected')).to.equal(testCase.result[service]);
          }
        });
      }, this);
    });

  });
});
window.require.register("test/installer/step5_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');
  require('controllers/wizard/step5_controller');
  var components = require('data/service_components');

  describe('App.WizardStep5Controller', function () {
    var controller = App.WizardStep5Controller.create();
    controller.set('content', {});
    var cpu = 2, memory = 4;
    var schemes = [
      {'description': 'empty condition'},
      {
        'description': 'second host if amount more than 1',
        "else": 1
      },
      {
        'description': 'first host if amount less than 3, third host if amount less than 6, fourth host if amount more than 5',
        "3": 0,
        "6": 2,
        "else": 3
      },
      {
        'description': 'second host if amount less than 3, second host if amount less than 6, third host if amount less than 31, sixth host if amount more than 30',
        "3": 1,
        "6": 1,
        "31": 2,
        "else": 5
      }
    ];
    var test_config = [
      {
        title: '1 host',
        hosts: ['host0'],
        equals: [0, 0, 0, 0]
      },
      {
        title: '2 hosts',
        hosts: ['host0', 'host1'],
        equals: [0, 1, 0, 1]
      },
      {
        title: '3 hosts',
        hosts: ['host0', 'host1', 'host2'],
        equals: [0, 1, 2, 1]
      },
      {
        title: '5 hosts',
        hosts: ['host0', 'host1', 'host2', 'host3', 'host4'],
        equals: [0, 1, 2, 1]
      },
      {
        title: '6 hosts',
        hosts: ['host0', 'host1', 'host2', 'host3', 'host4', 'host6'],
        equals: [0, 1, 3, 2]
      },
      {
        title: '10 hosts',
        hosts: ['host0', 'host1', 'host2', 'host3', 'host4', 'host5', 'host6', 'host7', 'host8', 'host9'],
        equals: [0, 1, 3, 2]
      },
      {
        title: '31 hosts',
        hosts: ['host0', 'host1', 'host2', 'host3', 'host4', 'host5', 'host6', 'host7', 'host8', 'host9', 'host10', 'host11', 'host12', 'host13', 'host14', 'host15', 'host16', 'host17', 'host18', 'host19', 'host20', 'host21', 'host22', 'host23', 'host24', 'host25', 'host26', 'host27', 'host28', 'host29', 'host30'],
        equals: [0, 1, 3, 5]
      }
    ];

    schemes.forEach(function(scheme, index) {
      describe('#getHostForComponent() condition: ' + scheme.description, function() {

        delete scheme['description'];

        test_config.forEach(function(test) {
          it(test.title, function () {
            controller.get('hosts').clear();
            test.hosts.forEach(function(_host) {
              controller.get('hosts').pushObject(Em.Object.create({
                host_name: _host,
                cpu: cpu,
                memory: memory
              }));
            });
            expect(controller.getHostForComponent(test.hosts.length, scheme).host_name).to.equal(test.hosts[test.equals[index]]);
          });
        });
      });
    });

    describe('#getZooKeeperServer', function() {
      it('should be array with three host names if hosts number more than three', function() {
        var hosts = [
          {host_name: 'host1'},
          {host_name: 'host2'},
          {host_name: 'host3'}
        ];

        controller.set('hosts', hosts);
        expect(controller.getZooKeeperServer(hosts.length)).to.eql(['host1', 'host2', 'host3']);
      });

      it('should be array with one host names if hosts number less than three', function() {
        var hosts = [
          {host_name: 'host1'},
          {host_name: 'host2'}
        ];

        controller.set('hosts', hosts);
        expect(controller.getZooKeeperServer(hosts.length)).to.eql(['host1']);
      });
    });

    describe('#getGangliaServer', function() {
      it('should be host name if one host ', function() {
        var hosts = [
          {host_name: 'host1'}
        ];

        controller.set('hosts', hosts);
        expect(controller.getGangliaServer(hosts.length)).to.eql('host1');
      });

      it('should be host name if hosts number more than one', function() {
        var hosts = [
          {host_name: 'host1'},
          {host_name: 'host2'}
        ];

        controller.set('hosts', hosts);
        expect(controller.getGangliaServer(hosts.length)).to.eql('host1');
      });

      it('should be host name different from localhost if hosts number more than one', function() {
        var hosts = [
          {host_name: ''},
          {host_name: 'host2'}
        ];
        //first host_name is empty string, because of location.hostname = "" in console,
        //to implement current test case

        controller.set('hosts', hosts);
        expect(controller.getGangliaServer(hosts.length)).to.eql('host2');
      });
    });


    controller.set('content', {});

    describe('#isReassignWizard', function() {
      it('true if content.controllerName is reassignMasterController', function() {
        controller.set('content.controllerName', 'reassignMasterController');
        expect(controller.get('isReassignWizard')).to.equal(true);
      });
      it('false if content.controllerName is not reassignMasterController', function() {
        controller.set('content.controllerName', 'mainController');
        expect(controller.get('isReassignWizard')).to.equal(false);
      });
    });

  });
  
});
window.require.register("test/installer/step6_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');
  require('controllers/wizard/step6_controller');

  describe('App.WizardStep6Controller', function () {

    var controller = App.WizardStep6Controller.create();

    controller.set('content', {
      hosts: {},
      masterComponentHosts: {},
      services: [
        Em.Object.create({
          serviceName: 'MAPREDUCE',
          isSelected: true
        }),
        Em.Object.create({
          serviceName: 'YARN',
          isSelected: true
        }),
        Em.Object.create({
          serviceName: 'HBASE',
          isSelected: true
        }),
        Em.Object.create({
          serviceName: 'HDFS',
          isSelected: true
        })
      ]
    });

    var HOSTS = Em.A([ 'host0', 'host1', 'host2', 'host3' ]);

    var h = {};
    var m = [];
    HOSTS.forEach(function (hostName) {
      var obj = Em.Object.create({
        name: hostName,
        hostName: hostName,
        bootStatus: 'REGISTERED'
      });
      h[hostName] = obj;
      m.push(obj);
    });

    controller.set('content.hosts', h);
    controller.set('content.masterComponentHosts', m);
    controller.set('isMasters', false);


    describe('#loadStep', function() {
      controller.loadStep();
      it('Hosts are loaded', function() {
        expect(controller.get('hosts').length).to.equal(HOSTS.length);
      });

      it('Headers are loaded', function() {
        expect(controller.get('headers').length).not.to.equal(0);
      });
    });

    describe('#isAddHostWizard', function() {
      it('true if content.controllerName is addHostController', function() {
        controller.set('content.controllerName', 'addHostController');
        expect(controller.get('isAddHostWizard')).to.equal(true);
      });
      it('false if content.controllerName is not addHostController', function() {
        controller.set('content.controllerName', 'mainController');
        expect(controller.get('isAddHostWizard')).to.equal(false);
      });
    });

    describe('#isInstallerWizard', function() {
      it('true if content.controllerName is addHostController', function() {
        controller.set('content.controllerName', 'installerController');
        expect(controller.get('isInstallerWizard')).to.equal(true);
      });
      it('false if content.controllerName is not addHostController', function() {
        controller.set('content.controllerName', 'mainController');
        expect(controller.get('isInstallerWizard')).to.equal(false);
      });
    });

    describe('#isAddServiceWizard', function() {
      it('true if content.controllerName is addServiceController', function() {
        controller.set('content.controllerName', 'addServiceController');
        expect(controller.get('isAddServiceWizard')).to.equal(true);
      });
      it('false if content.controllerName is not addServiceController', function() {
        controller.set('content.controllerName', 'mainController');
        expect(controller.get('isAddServiceWizard')).to.equal(false);
      });
    });

    describe('#setAllNodes', function() {

      var test_config = Em.A([
        {
          title: 'DataNode',
          name: 'DATANODE',
          state: false
        },
        {
          title: 'DataNode',
          name: 'DATANODE',
          state: true
        },
        {
          title: 'TaskTracker',
          name: 'TASKTRACKER',
          state: false
        },
        {
          title: 'TaskTracker',
          name: 'TASKTRACKER',
          state: true
        }
      ]);

      test_config.forEach(function(test) {
        it((test.state?'Select':'Deselect') + ' all ' + test.title, function() {
          controller.setAllNodes(test.name, test.state);
          var hosts = controller.get('hosts');
          hosts.forEach(function(host) {
            var cb = host.get('checkboxes').filterProperty('isInstalled', false).findProperty('component', test.name);
            if (cb) {
              expect(cb.get('checked')).to.equal(test.state);
            }
          });
        });
      });


    });

    describe('#isServiceSelected', function() {
      controller.get('content.services').forEach(function(service) {
        it(service.serviceName + ' is selected', function() {
          expect(controller.isServiceSelected(service.serviceName)).to.equal(true);
        });
      });
      var unselectedService = 'FAKESERVICE';
      it(unselectedService + ' is not selected', function() {
        expect(controller.isServiceSelected(unselectedService)).to.equal(false);
      });
    });

    describe('#validateEachComponent', function() {
      it('Nothing checked', function() {
        controller.get('hosts').forEach(function(host) {
          host.get('checkboxes').setEach('checked', false);
        });
        expect(controller.validateEachComponent('')).to.equal(false);
      });
      it('One slave is not selected for no one host', function() {
        controller.get('hosts').forEach(function(host) {
          host.get('checkboxes').forEach(function(checkbox, index) {
            checkbox.set('checked', index === 0);
          });
        });
        expect(controller.validateEachComponent('')).to.equal(false);
      });
      it('All checked', function() {
        controller.get('hosts').forEach(function(host) {
          host.get('checkboxes').forEach(function(checkbox) {
            checkbox.set('checked', true);
          });
        });
        expect(controller.validateEachComponent('')).to.equal(true);
      });
    });

    describe('#validateEachHost', function() {
      it('Nothing checked', function() {
        controller.get('hosts').forEach(function(host) {
          host.get('checkboxes').setEach('checked', false);
        });
        expect(controller.validateEachHost('')).to.equal(false);
      });
      it('One host doesn\'t have assigned slaves', function() {
        controller.get('hosts').forEach(function(host, index) {
          host.get('checkboxes').setEach('checked', index === 0);
        });
        expect(controller.validateEachHost('')).to.equal(false);
      });
      it('All checked', function() {
        controller.get('hosts').forEach(function(host) {
          host.get('checkboxes').setEach('checked', true);
        });
        expect(controller.validateEachHost('')).to.equal(true);
      });
    });

  });
  
});
window.require.register("test/installer/step7_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  var numberUtils = require('utils/number_utils');
  require('controllers/wizard/step7_controller');

  var installerStep7Controller;

  describe('App.InstallerStep7Controller', function () {

    describe('#installedServiceNames', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({
            controllerName: 'installerController',
            services: Em.A([
              Em.Object.create({
                isInstalled: true,
                serviceName: 'SQOOP'
              }),
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HDFS'
              })
            ])
          }),
          e: ['SQOOP', 'HDFS'],
          m: 'installerController with SQOOP'
        },
        {
          content: Em.Object.create({
            controllerName: 'installerController',
            services: Em.A([
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HIVE'
              }),
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HDFS'
              })
            ])
          }),
          e: ['HIVE', 'HDFS'],
          m: 'installerController without SQOOP'
        },
        {
          content: Em.Object.create({
            controllerName: 'addServiceController',
            services: Em.A([
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HIVE'
              }),
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HDFS'
              })
            ])
          }),
          e: ['HIVE', 'HDFS'],
          m: 'addServiceController without SQOOP'
        },
        {
          content: Em.Object.create({
            controllerName: 'addServiceController',
            services: Em.A([
              Em.Object.create({
                isInstalled: true,
                serviceName: 'SQOOP'
              }),
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HIVE'
              }),
              Em.Object.create({
                isInstalled: true,
                serviceName: 'HDFS'
              })
            ])
          }),
          e: ['HIVE', 'HDFS'],
          m: 'addServiceController with SQOOP'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          installerStep7Controller = App.WizardStep7Controller.create({
            content: test.content
          });
          expect(installerStep7Controller.get('installedServiceNames')).to.include.members(test.e);
          expect(test.e).to.include.members(installerStep7Controller.get('installedServiceNames'));
        });
      });

    });

  });
  
});
window.require.register("test/installer/step8_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('controllers/wizard/step8_controller');

  var installerStep8Controller;

  describe('App.WizardStep8Controller', function() {

    var configs = Em.A([
      Em.Object.create({filename: 'hdfs-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'hdfs-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'hue-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'hue-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'mapred-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'mapred-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'yarn-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'yarn-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'capacity-scheduler.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'capacity-scheduler.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'mapred-queue-acls.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'mapred-queue-acls.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'hbase-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'hbase-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'oozie-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'oozie-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'hive-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'hive-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'webhcat-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'webhcat-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'tez-site.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'tez-site.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'falcon-startup.properties.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'falcon-startup.properties.xml', name: 'p2', value: 'v2'}),
      Em.Object.create({filename: 'falcon-runtime.properties.xml', name: 'p1', value: 'v1'}),
      Em.Object.create({filename: 'falcon-runtime.properties.xml', name: 'p2', value: 'v2'})
    ]);

    beforeEach(function() {
      installerStep8Controller = App.WizardStep8Controller.create({
        configs: configs
      });
    });

    var siteObjTests = Em.A([
      {name: 'createHdfsSiteObj', e: {type: 'hdfs-site', tag: 'version1', l: 2}},
      {name: 'createHueSiteObj', e: {type: 'hue-site', tag: 'version1', l: 2}},
      {name: 'createMrSiteObj', e: {type: 'mapred-site', tag: 'version1', l: 2}},
      {name: 'createYarnSiteObj', e: {type: 'yarn-site', tag: 'version1', l: 2}},
      {name: 'createCapacityScheduler', e: {type: 'capacity-scheduler', tag: 'version1', l: 2}},
      {name: 'createMapredQueueAcls', e: {type: 'mapred-queue-acls', tag: 'version1', l: 2}},
      {name: 'createHbaseSiteObj', e: {type: 'hbase-site', tag: 'version1', l: 2}},
      {name: 'createOozieSiteObj', e: {type: 'oozie-site', tag: 'version1', l: 2}},
      {name: 'createHiveSiteObj', e: {type: 'hive-site', tag: 'version1', l: 2}},
      {name: 'createWebHCatSiteObj', e: {type: 'webhcat-site', tag: 'version1', l: 2}},
      {name: 'createTezSiteObj', e: {type: 'tez-site', tag: 'version1', l: 2}},
      {name: 'createFalconStartupSiteObj', e: {type: 'falcon-startup.properties', tag: 'version1', l: 2}},
      {name: 'createFalconRuntimeSiteObj', e: {type: 'falcon-runtime.properties', tag: 'version1', l: 2}}
    ]);

    siteObjTests.forEach(function(test) {
      describe('#' + test.name, function() {

        it(test.name, function() {

          var siteObj = installerStep8Controller.createSiteObj(test.e.type);
          expect(siteObj.tag).to.equal(test.e.tag);
          expect(Em.keys(siteObj.properties).length).to.equal(test.e.l);
        });

      });
    });

    describe('#createConfigurations', function() {

      it('verify if its installerController', function() {
        installerStep8Controller.set('content', {controllerName: 'installerController', services: Em.A([])});
        installerStep8Controller.createConfigurations();
        expect(installerStep8Controller.get('serviceConfigTags').length).to.equal(4);
        installerStep8Controller.clearStep();
      });

      it('verify if its not installerController', function() {
        installerStep8Controller.set('content', {controllerName: 'addServiceController', services: Em.A([])});
        installerStep8Controller.createConfigurations();
        expect(installerStep8Controller.get('serviceConfigTags').length).to.equal(2);
        installerStep8Controller.clearStep();
      });

      it('verify not App.supports.capacitySchedulerUi', function() {
        installerStep8Controller = App.WizardStep8Controller.create({
          content: {controllerName: 'addServiceController', services: Em.A([{isSelected:true,isInstalled:false,serviceName:'MAPREDUCE'}])},
          configs: configs
        });
        App.set('supports.capacitySchedulerUi', false);
        installerStep8Controller.createConfigurations();
        expect(installerStep8Controller.get('serviceConfigTags').length).to.equal(4);
        installerStep8Controller.clearStep();
      });

      it('verify App.supports.capacitySchedulerUi', function() {
        installerStep8Controller = App.WizardStep8Controller.create({
          content: {controllerName: 'addServiceController', services: Em.A([{isSelected:true,isInstalled:false,serviceName:'MAPREDUCE'}])},
          configs: configs
        });
        App.set('supports.capacitySchedulerUi', true);
        installerStep8Controller.createConfigurations();
        expect(installerStep8Controller.get('serviceConfigTags').length).to.equal(6);
        installerStep8Controller.clearStep();
      });


      // e - without global and core!
      var tests = Em.A([
        {selectedServices: Em.A(['MAPREDUCE2']),e: 2},
        {selectedServices: Em.A(['MAPREDUCE2','YARN']),e: 5},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE']),e: 7},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE']),e: 9},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE']),e: 12},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT']),e: 13},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE']),e: 14},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG']),e: 15},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON']),e: 17},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON','STORM']),e: 18},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON','STORM','TEZ']),e: 19},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON','STORM','TEZ','ZOOKEEPER']),e: 21}

      ]);

      tests.forEach(function(test) {
        it(test.selectedServices.join(','), function() {
          var services = test.selectedServices.map(function(serviceName) {
            return Em.Object.create({isSelected:true,isInstalled:false,serviceName:serviceName});
          });
          installerStep8Controller = App.WizardStep8Controller.create({
            content: {controllerName: 'addServiceController', services: services},
            configs: configs
          });
          installerStep8Controller.createConfigurations();
          expect(installerStep8Controller.get('serviceConfigTags').length).to.equal(test.e + 2);
          installerStep8Controller.clearStep();
        });
      });

      // Verify xml character escaping is not done for log4j files and falcon startup-properties and runtime-properties files.
      it('escape xml character for installer wizard', function() {
        var services = Em.A([Em.Object.create({isSelected:true,isInstalled:false,serviceName:'OOZIE'}),
          Em.Object.create({isSelected:true,isInstalled:false,serviceName:'FALCON'})]);

        var nonXmlConfigs = [
          {filename: 'oozie-log4j.xml', name: 'p1', value: "'.'v1"},
          {filename: 'falcon-startup.properties.xml', name: 'p1', value: "'.'v1"} ,
          {filename: 'falcon-startup.properties.xml', name: 'p2', value: 'v2'},
          {filename: 'falcon-runtime.properties.xml', name: 'p1', value: "'.'v1"},
          {filename: 'falcon-runtime.properties.xml', name: 'p2', value: 'v2'}
        ];
        installerStep8Controller = App.WizardStep8Controller.create({
          content: {controllerName: 'installerController', services: services},
          configs: nonXmlConfigs
        });
        installerStep8Controller.createConfigurations();
        var nonXmlConfigTypes = ['oozie-log4j','falcon-startup.properties','falcon-runtime.properties'];
        nonXmlConfigTypes.forEach(function(_nonXmlConfigType){
          var nonXmlConfigTypeObj = installerStep8Controller.get('serviceConfigTags').findProperty('type',_nonXmlConfigType);
          var nonXmlSitePropertyVal = nonXmlConfigTypeObj.properties['p1'];
          expect(nonXmlSitePropertyVal).to.equal("'.'v1");
        });
        installerStep8Controller.clearStep();
      });

    });

    describe('#createSelectedServicesData', function() {

      var tests = Em.A([
        {selectedServices: Em.A(['MAPREDUCE2']),e: 2},
        {selectedServices: Em.A(['MAPREDUCE2','YARN']),e: 5},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE']),e: 7},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE']),e: 9},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE']),e: 12},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT']),e: 13},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE']),e: 14},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG']),e: 15},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON']),e: 17},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON','STORM']),e: 18},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON','STORM','TEZ']),e: 19},
        {selectedServices: Em.A(['MAPREDUCE2','YARN','HBASE','OOZIE','HIVE','WEBHCAT','HUE','PIG','FALCON','STORM','TEZ','ZOOKEEPER']),e: 21}
      ]);

      tests.forEach(function(test) {
        it(test.selectedServices.join(','), function() {
          var services = test.selectedServices.map(function(serviceName) {
            return Em.Object.create({isSelected:true,isInstalled:false,serviceName:serviceName});
          });
          installerStep8Controller = App.WizardStep8Controller.create({
            content: {controllerName: 'addServiceController', services: services},
            configs: configs
          });
          var serviceData = installerStep8Controller.createSelectedServicesData();
          expect(serviceData.mapProperty('ServiceInfo.service_name')).to.eql(test.selectedServices.toArray());
          installerStep8Controller.clearStep();
        });
      });

    });

    describe('#getRegisteredHosts', function() {

      var tests = Em.A([
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'REGISTERED',name:'h1'}),
            h2: Em.Object.create({bootStatus:'OTHER',name:'h2'})
          },
          e: ['h1'],
          m: 'Two hosts, one registered'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'OTHER',name:'h1'}),
            h2: Em.Object.create({bootStatus:'OTHER',name:'h2'})
          },
          e: [],
          m: 'Two hosts, zero registered'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'REGISTERED',name:'h1'}),
            h2: Em.Object.create({bootStatus:'REGISTERED',name:'h2'})
          },
          e: ['h1','h2'],
          m: 'Two hosts, two registered'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          installerStep8Controller.set('content', Em.Object.create({hosts: test.hosts}));
          var registeredHosts = installerStep8Controller.getRegisteredHosts();
          expect(registeredHosts.mapProperty('hostName').toArray()).to.eql(test.e);
        });
      });

    });

    describe('#createRegisterHostData', function() {

      var tests = Em.A([
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'REGISTERED',name:'h1',isInstalled:false}),
            h2: Em.Object.create({bootStatus:'REGISTERED',name:'h2',isInstalled:false})
          },
          e: ['h1', 'h2'],
          m: 'two registered, two isInstalled false'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'OTHER',name:'h1',isInstalled:false}),
            h2: Em.Object.create({bootStatus:'REGISTERED',name:'h2',isInstalled:false})
          },
          e: ['h2'],
          m: 'one registered, two isInstalled false'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'OTHER',name:'h1',isInstalled:true}),
            h2: Em.Object.create({bootStatus:'REGISTERED',name:'h2',isInstalled:false})
          },
          e: ['h2'],
          m: 'one registered, one isInstalled false'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'REGISTERED',name:'h1',isInstalled:true}),
            h2: Em.Object.create({bootStatus:'REGISTERED',name:'h2',isInstalled:false})
          },
          e: ['h2'],
          m: 'two registered, one isInstalled false'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'OTHER',name:'h1',isInstalled:false}),
            h2: Em.Object.create({bootStatus:'OTHER',name:'h2',isInstalled:false})
          },
          e: [],
          m: 'zero registered, two isInstalled false'
        },
        {
          hosts: {
            h1: Em.Object.create({bootStatus:'REGISTERED',name:'h1',isInstalled:true}),
            h2: Em.Object.create({bootStatus:'REGISTERED',name:'h2',isInstalled:true})
          },
          e: [],
          m: 'two registered, zeto insInstalled false'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          installerStep8Controller.set('content', Em.Object.create({hosts: test.hosts}));
          var registeredHostData = installerStep8Controller.createRegisterHostData();
          expect(registeredHostData.mapProperty('Hosts.host_name').toArray()).to.eql(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/installer/step9_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var Ember = require('ember');
  var App = require('app');
  require('models/hosts');
  require('controllers/wizard/step9_controller');
  require('utils/helper');

  describe('App.InstallerStep9Controller', function () {

    describe('#isSubmitDisabled', function () {
      var tests = Em.A([
        {controllerName: 'addHostController', state: 'STARTED', e: false},
        {controllerName: 'addHostController', state: 'START FAILED', e: false},
        {controllerName: 'addHostController', state: 'INSTALL FAILED', e: false},
        {controllerName: 'addHostController', state: 'PENDING', e: true},
        {controllerName: 'addHostController', state: 'INSTALLED', e: true},
        {controllerName: 'addServiceController', state: 'STARTED', e: false},
        {controllerName: 'addServiceController', state: 'START FAILED', e: false},
        {controllerName: 'addServiceController', state: 'INSTALL FAILED', e: false},
        {controllerName: 'addServiceController', state: 'PENDING', e: true},
        {controllerName: 'addServiceController', state: 'INSTALLED', e: true},
        {controllerName: 'installerController', state: 'STARTED', e: false},
        {controllerName: 'installerController', state: 'START FAILED', e: false},
        {controllerName: 'installerController', state: 'INSTALL FAILED', e: true},
        {controllerName: 'installerController', state: 'INSTALLED', e: true},
        {controllerName: 'installerController', state: 'PENDING', e: true}
      ]);
      tests.forEach(function (test) {
        var controller = App.WizardStep9Controller.create({
          content: {
            controllerName: test.controllerName,
            cluster: {
              status: test.state
            }
          }
        });
        it('controllerName is ' + test.controllerName + '; cluster status is ' + test.state + '; isSubmitDisabled should be ' + test.e, function () {
          expect(controller.get('isSubmitDisabled')).to.equal(test.e);
        });
      });

    });

    describe('#status', function () {
      var tests = Em.A([
        {
          hosts: [
            {status: 'failed'},
            {status: 'success'}
          ],
          isStepFailed: false,
          progress: '100',
          m: 'One host is failed',
          e: 'failed'
        },
        {
          hosts: [
            {status: 'warning'},
            {status: 'success'}
          ],
          m: 'One host is failed and step is not failed',
          isStepFailed: false,
          progress: '100',
          e: 'warning'
        },
        {
          hosts: [
            {status: 'warning'},
            {status: 'success'}
          ],
          m: 'One host is failed and step is failed',
          isStepFailed: true,
          progress: '100',
          e: 'failed'
        },
        {
          hosts: [
            {status: 'success'},
            {status: 'success'}
          ],
          m: 'All hosts are success and progress is 100',
          isStepFailed: false,
          progress: '100',
          e: 'success'
        },
        {
          hosts: [
            {status: 'success'},
            {status: 'success'}
          ],
          m: 'All hosts are success and progress is 50',
          isStepFailed: false,
          progress: '50',
          e: 'info'
        }
      ]);
      tests.forEach(function (test) {
        var controller = App.WizardStep9Controller.create({hosts: test.hosts, isStepFailed: function () {
          return test.isStepFailed
        }, progress: test.progress});
        controller.updateStatus();
        it(test.m, function () {
          expect(controller.get('status')).to.equal(test.e);
        });
      });
    });

    describe('#showRetry', function () {
      it('cluster status is not INSTALL FAILED', function () {
        var controller = App.WizardStep9Controller.create({content: {cluster: {status: 'INSTALLED'}}});
        expect(controller.get('showRetry')).to.equal(false);
      });
      it('cluster status is INSTALL FAILED', function () {
        var controller = App.WizardStep9Controller.create({content: {cluster: {status: 'INSTALL FAILED'}}});
        expect(controller.get('showRetry')).to.equal(true);
      });
    });

    describe('#resetHostsForRetry', function () {
      var hosts = {'host1': Em.Object.create({status: 'failed', message: 'Failed'}), 'host2': Em.Object.create({status: 'success', message: 'Success'})};
      var controller = App.WizardStep9Controller.create({content: {hosts: hosts}});
      it('All should have status "pending" and message "Waiting"', function () {
        controller.resetHostsForRetry();
        for (var name in hosts) {
          if (hosts.hasOwnProperty(name)) {
            expect(controller.get('content.hosts')[name].get('status', 'pending')).to.equal('pending');
            expect(controller.get('content.hosts')[name].get('message', 'Waiting')).to.equal('Waiting');
          }
        }
      });
    });

    var hosts_for_load_and_render = {
      'host1': {
        message: 'message1',
        status: 'unknown',
        progress: '1',
        logTasks: [
          {},
          {}
        ],
        bootStatus: 'REGISTERED'
      },
      'host2': {
        message: '',
        status: 'failed',
        progress: '1',
        logTasks: [
          {},
          {}
        ],
        bootStatus: ''
      },
      'host3': {
        message: '',
        status: 'waiting',
        progress: null,
        logTasks: [
          {},
          {}
        ],
        bootStatus: ''
      },
      'host4': {
        message: 'message4',
        status: null,
        progress: '10',
        logTasks: [
          {}
        ],
        bootStatus: 'REGISTERED'
      }
    };

    describe('#loadHosts', function () {
      var controller = App.WizardStep9Controller.create({content: {hosts: hosts_for_load_and_render}});
      controller.loadHosts();
      var loaded_hosts = controller.get('hosts');
      it('Only REGISTERED hosts', function () {
        expect(loaded_hosts.length).to.equal(2);
      });
      it('All hosts have progress 0', function () {
        expect(loaded_hosts.everyProperty('progress', 0)).to.equal(true);
      });
      it('All hosts have progress 0', function () {
        expect(loaded_hosts.everyProperty('progress', 0)).to.equal(true);
      });
      it('All host don\'t have logTasks', function () {
        expect(loaded_hosts.everyProperty('logTasks.length', 0)).to.equal(true);
      });
    });

    describe('#hostHasClientsOnly', function () {
      var tests = Em.A([
        {
          hosts: [
            Em.Object.create({
              hostName: 'host1',
              logTasks: [
                {Tasks: {role: 'HDFS_CLIENT'}},
                {Tasks: {role: 'DATANODE'}}
              ],
              status: 'old_status',
              progress: '10',
              e: {status: 'old_status', progress: '10'}
            }),
            Em.Object.create({
              hostName: 'host2',
              logTasks: [
                {Tasks: {role: 'HDFS_CLIENT'}}
              ],
              status: 'old_status',
              progress: '10',
              e: {status: 'success', progress: '100'}
            })
          ],
          jsonError: false
        },
        {
          hosts: [
            Em.Object.create({
              hostName: 'host1',
              logTasks: [
                {Tasks: {role: 'HDFS_CLIENT'}},
                {Tasks: {role: 'DATANODE'}}
              ],
              status: 'old_status',
              progress: '10',
              e: {status: 'success', progress: '100'}
            }),
            Em.Object.create({
              hostName: 'host2',
              logTasks: [
                {Tasks: {role: 'HDFS_CLIENT'}}
              ],
              status: 'old_status',
              progress: '10',
              e: {status: 'success', progress: '100'}
            })
          ],
          jsonError: true
        }
      ]);
      tests.forEach(function (test) {
        it('', function () {
          var controller = App.WizardStep9Controller.create({hosts: test.hosts});
          controller.hostHasClientsOnly(test.jsonError);
          test.hosts.forEach(function (host) {
            expect(controller.get('hosts').findProperty('hostName', host.hostName).get('status')).to.equal(host.e.status);
            expect(controller.get('hosts').findProperty('hostName', host.hostName).get('progress')).to.equal(host.e.progress);
          });
        });
      });
    });

    describe('#onSuccessPerHost', function () {
      var tests = Em.A([
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'pending'}),
          actions: [],
          e: {status: 'success'},
          m: 'No tasks for host'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'success'},
          m: 'All Tasks COMPLETED and cluster status INSTALLED'
        },
        {
          cluster: {status: 'FAILED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'info'},
          m: 'All Tasks COMPLETED and cluster status FAILED'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'FAILED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'info'},
          m: 'Not all Tasks COMPLETED and cluster status INSTALLED'
        },
        {
          cluster: {status: 'FAILED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'FAILED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'info'},
          m: 'Not all Tasks COMPLETED and cluster status FAILED'
        }
      ]);
      tests.forEach(function (test) {
        var controller = App.WizardStep9Controller.create({content: {cluster: {status: test.cluster.status}}});
        controller.onSuccessPerHost(test.actions, test.host);
        it(test.m, function () {
          expect(test.host.status).to.equal(test.e.status);
        });
      });
    });

    describe('#onErrorPerHost', function () {
      var tests = Em.A([
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'pending'}),
          actions: [],
          e: {status: 'pending'},
          isMasterFailed: false,
          m: 'No tasks for host'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'FAILED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'warning'},
          isMasterFailed: false,
          m: 'One Task FAILED and cluster status INSTALLED'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'ABORTED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'warning'},
          isMasterFailed: false,
          m: 'One Task ABORTED and cluster status INSTALLED'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'TIMEDOUT'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'warning'},
          isMasterFailed: false,
          m: 'One Task TIMEDOUT and cluster status INSTALLED'
        },
        {
          cluster: {status: 'PENDING'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'FAILED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'failed'},
          isMasterFailed: true,
          m: 'One Task FAILED and cluster status PENDING isMasterFailed true'
        },
        {
          cluster: {status: 'PENDING'},
          host: Em.Object.create({status: 'info'}),
          actions: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {status: 'info'},
          isMasterFailed: false,
          m: 'One Task FAILED and cluster status PENDING isMasterFailed false'
        }
      ]);
      tests.forEach(function (test) {
        var controller = App.WizardStep9Controller.create({content: {cluster: {status: test.cluster.status}}, isMasterFailed: function () {
          return test.isMasterFailed;
        }});
        controller.onErrorPerHost(test.actions, test.host);
        it(test.m, function () {
          expect(test.host.status).to.equal(test.e.status);
        });
      });
    });

    describe('#isMasterFailed', function () {
      var tests = Em.A([
        {
          actions: [
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'DATANODE'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'TASKTRACKER'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'HBASE_REGIONSERVER'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'GANGLIA_MONITOR'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'SUPERVISOR'}}
          ],
          e: false,
          m: 'No one Master is failed'
        },
        {
          actions: [
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'NAMENODE'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'TASKTRACKER'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'HBASE_REGIONSERVER'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'GANGLIA_MONITOR'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'SUPERVISOR'}}
          ],
          e: true,
          m: 'One Master is failed'
        },
        {
          actions: [
            {Tasks: {command: 'PENDING', status: 'FAILED', role: 'NAMENODE'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'TASKTRACKER'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'HBASE_REGIONSERVER'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'GANGLIA_MONITOR'}},
            {Tasks: {command: 'INSTALL', status: 'FAILED', role: 'SUPERVISOR'}}
          ],
          e: false,
          m: 'one Master is failed but command is not install'
        }
      ]);
      tests.forEach(function (test) {
        it(test.m, function () {
          var controller = App.WizardStep9Controller.create();
          expect(controller.isMasterFailed(test.actions)).to.equal(test.e);
        });
      });
    });

    describe('#onInProgressPerHost', function () {
      var tests = Em.A([
        {
          host: Em.Object.create({message: 'default_message'}),
          actions: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {message: 'default_message', b: true},
          m: 'All Tasks COMPLETED'
        },
        {
          host: Em.Object.create({message: 'default_message'}),
          actions: [
            {Tasks: {status: 'IN_PROGRESS'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {message: 'default_message', b: false},
          m: 'One Task IN_PROGRESS'
        },
        {
          host: Em.Object.create({message: 'default_message'}),
          actions: [
            {Tasks: {status: 'QUEUED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {message: 'default_message', b: false},
          m: 'One Task QUEUED'
        },
        {
          host: Em.Object.create({message: 'default_message'}),
          actions: [
            {Tasks: {status: 'PENDING'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: {message: 'default_message', b: false},
          m: 'One Task PENDING'
        }
      ]);
      tests.forEach(function (test) {
        it(test.m, function () {
          var controller = App.WizardStep9Controller.create();
          controller.onInProgressPerHost(test.actions, test.host);
          expect(test.host.message == test.e.message).to.equal(test.e.b);
        });
      });
    });

    describe('#progressPerHost', function () {
      var tests = Em.A([
        {
          cluster: {status: 'PENDING'},
          host: Em.Object.create({progress: 0}),
          actions: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'QUEUED'}},
            {Tasks: {status: 'QUEUED'}},
            {Tasks: {status: 'IN_PROGRESS'}}
          ],
          e: {ret: 17, host: '17'},
          m: 'All types of status available. cluster status PENDING'
        },
        {
          cluster: {status: 'PENDING'},
          host: Em.Object.create({progress: 0}),
          actions: [],
          e: {ret: 33, host: '33'},
          m: 'No tasks available. cluster status PENDING'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({progress: 0}),
          actions: [],
          e: {ret: 100, host: '100'},
          m: 'No tasks available. cluster status INSTALLED'
        },
        {
          cluster: {status: 'INSTALLED'},
          host: Em.Object.create({progress: 0}),
          actions: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'QUEUED'}},
            {Tasks: {status: 'QUEUED'}},
            {Tasks: {status: 'IN_PROGRESS'}}
          ],
          e: {ret: 68, host: '68'},
          m: 'All types of status available. cluster status INSTALLED'
        },
        {
          cluster: {status: 'FAILED'},
          host: Em.Object.create({progress: 0}),
          actions: [],
          e: {ret: 100, host: '100'},
          m: 'Cluster status is not PENDING or INSTALLED'
        }
      ]);
      tests.forEach(function (test) {
        it(test.m, function () {
          var controller = App.WizardStep9Controller.create({content: {cluster: {status: test.cluster.status}}});
          var progress = controller.progressPerHost(test.actions, test.host);
          expect(progress).to.equal(test.e.ret);
          expect(test.host.progress).to.equal(test.e.host);
        });
      });
    });

    describe('#clearStep', function () {
      var controller = App.WizardStep9Controller.create({hosts: [
        {},
        {},
        {}
      ]});
      it('All to default values', function () {
        controller.clearStep();
        expect(controller.get('hosts.length')).to.equal(0);
        expect(controller.get('status')).to.equal('info');
        expect(controller.get('progress')).to.equal('0');
        expect(controller.get('numPolls')).to.equal(1);
      });
    });

    describe('#replacePolledData', function () {
      var controller = App.WizardStep9Controller.create({polledData: [
        {},
        {},
        {}
      ]});
      var newPolledData = [
        {}
      ];
      controller.replacePolledData(newPolledData);
      it('replacing polled data', function () {
        expect(controller.get('polledData.length')).to.equal(newPolledData.length);
      });
    });

    describe('#isSuccess', function () {
      var tests = Em.A([
        {
          polledData: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'COMPLETED'}}
          ],
          e: true,
          m: 'All tasks are COMPLETED'
        },
        {
          polledData: [
            {Tasks: {status: 'COMPLETED'}},
            {Tasks: {status: 'FAILED'}}
          ],
          e: false,
          m: 'Not all tasks are COMPLETED'
        }
      ]);
      tests.forEach(function (test) {
        it(test.m, function () {
          var controller = App.WizardStep9Controller.create();
          expect(controller.isSuccess(test.polledData)).to.equal(test.e);
        });
      });
    });

    describe('#isStepFailed', function () {
      var tests = Em.A([
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'GANGLIA_MONITOR', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'GANGLIA_MONITOR', status: 'FAILED'}},
            {Tasks: {command: 'INSTALL', role: 'GANGLIA_MONITOR', status: 'PENDING'}}
          ],
          e: true,
          m: 'GANGLIA_MONITOR 2/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'GANGLIA_MONITOR', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'GANGLIA_MONITOR', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'GANGLIA_MONITOR', status: 'PENDING'}}
          ],
          e: false,
          m: 'GANGLIA_MONITOR 1/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'HBASE_REGIONSERVER', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'HBASE_REGIONSERVER', status: 'FAILED'}},
            {Tasks: {command: 'INSTALL', role: 'HBASE_REGIONSERVER', status: 'PENDING'}}
          ],
          e: true,
          m: 'HBASE_REGIONSERVER 2/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'HBASE_REGIONSERVER', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'HBASE_REGIONSERVER', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'HBASE_REGIONSERVER', status: 'PENDING'}}
          ],
          e: false,
          m: 'HBASE_REGIONSERVER 1/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'TASKTRACKER', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'TASKTRACKER', status: 'FAILED'}},
            {Tasks: {command: 'INSTALL', role: 'TASKTRACKER', status: 'PENDING'}}
          ],
          e: true,
          m: 'TASKTRACKER 2/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'TASKTRACKER', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'TASKTRACKER', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'TASKTRACKER', status: 'PENDING'}}
          ],
          e: false,
          m: 'TASKTRACKER 1/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'FAILED'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}}
          ],
          e: true,
          m: 'DATANODE 2/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}}
          ],
          e: false,
          m: 'DATANODE 1/3 failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'NAMENODE', status: 'TIMEDOUT'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}}
          ],
          e: true,
          m: 'NAMENODE failed'
        },
        {
          polledData: [
            {Tasks: {command: 'INSTALL', role: 'NAMENODE', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}},
            {Tasks: {command: 'INSTALL', role: 'DATANODE', status: 'PENDING'}}
          ],
          e: false,
          m: 'Nothing failed failed'
        }
      ]);
      tests.forEach(function (test) {
        var controller = App.WizardStep9Controller.create({polledData: test.polledData});
        it(test.m, function () {
          expect(controller.isStepFailed()).to.equal(test.e);
        });
      });
    });

    describe('#getUrl', function () {
      var clusterName = 'tdk';
      var cluster = App.WizardStep9Controller.create({content: {cluster: {name: clusterName, requestId: null}}});
      it('check requestId priority', function () {
        cluster.set('content.cluster.requestId', 123);
        var url = cluster.getUrl(321);
        expect(url).to.equal(App.apiPrefix + '/clusters/' + clusterName + '/requests/' + '321' + '?fields=tasks/Tasks/command,tasks/Tasks/exit_code,tasks/Tasks/start_time,tasks/Tasks/end_time,tasks/Tasks/host_name,tasks/Tasks/id,tasks/Tasks/role,tasks/Tasks/status&minimal_response=true');
        url = cluster.getUrl();
        expect(url).to.equal(App.apiPrefix + '/clusters/' + clusterName + '/requests/' + '123' + '?fields=tasks/Tasks/command,tasks/Tasks/exit_code,tasks/Tasks/start_time,tasks/Tasks/end_time,tasks/Tasks/host_name,tasks/Tasks/id,tasks/Tasks/role,tasks/Tasks/status&minimal_response=true');
      });
    });

    describe('#finishState', function () {
      var statuses = Em.A(['INSTALL FAILED', 'START FAILED', 'STARTED']);
      it('Installer is finished', function () {
        statuses.forEach(function (status) {
          var controller = App.WizardStep9Controller.create({content: {cluster: {status: status}}});
          var result = controller.finishState();
          expect(result).to.equal(true);
        });
      });
      it('Unknown cluster status ', function () {
        var controller = App.WizardStep9Controller.create({content: {cluster: {status: 'FAKE_STATUS'}}});
        var result = controller.finishState();
        expect(result).to.equal(false);
      });
    });

    describe('#setLogTasksStatePerHost', function () {
      var tests = Em.A([
        {
          tasksPerHost: [
            {Tasks: {id: 1, status: 'COMPLETED'}},
            {Tasks: {id: 2, status: 'COMPLETED'}}
          ],
          tasks: [],
          e: {m: 'COMPLETED', l: 2},
          m: 'host didn\'t have tasks and got 2 new'
        },
        {
          tasksPerHost: [
            {Tasks: {id: 1, status: 'COMPLETED'}},
            {Tasks: {id: 2, status: 'COMPLETED'}}
          ],
          tasks: [
            {Tasks: {id: 1, status: 'IN_PROGRESS'}},
            {Tasks: {id: 2, status: 'IN_PROGRESS'}}
          ],
          e: {m: 'COMPLETED', l: 2},
          m: 'host had 2 tasks and got both updated'
        },
        {
          tasksPerHost: [],
          tasks: [
            {Tasks: {id: 1, status: 'IN_PROGRESS'}},
            {Tasks: {id: 2, status: 'IN_PROGRESS'}}
          ],
          e: {m: 'IN_PROGRESS', l: 2},
          m: 'host had 2 tasks and didn\'t get updates'
        },
        {
          tasksPerHost: [
            {Tasks: {id: 1, status: 'COMPLETED'}},
            {Tasks: {id: 2, status: 'COMPLETED'}},
            {Tasks: {id: 3, status: 'COMPLETED'}}
          ],
          tasks: [
            {Tasks: {id: 1, status: 'IN_PROGRESS'}},
            {Tasks: {id: 2, status: 'IN_PROGRESS'}}
          ],
          e: {m: 'COMPLETED', l: 3},
          m: 'host had 2 tasks and got both updated and 1 new'
        }
      ]);
      tests.forEach(function (test) {
        it(test.m, function () {
          var controller = App.WizardStep9Controller.create({hosts: [Em.Object.create({logTasks: test.tasks})]});
          controller.setLogTasksStatePerHost(test.tasksPerHost, controller.get('hosts')[0]);
          expect(controller.get('hosts')[0].get('logTasks').everyProperty('Tasks.status', test.e.m)).to.equal(true);
          expect(controller.get('hosts')[0].get('logTasks.length')).to.equal(test.e.l);
        });
      });
    });

    describe('#parseHostInfo', function () {

      var tests = Em.A([
        {
          cluster: {status: 'PENDING'},
          hosts: Em.A([
            Em.Object.create({name: 'host1', status: '', message: '', progress: '', logTasks: []}),
            Em.Object.create({name: 'host2', status: '', message: '', progress: '', logTasks: []})
          ]),
          polledData: {
            tasks: [
              {Tasks: {host_name: 'host2', status: 'COMPLETED'}},
              {Tasks: {host_name: 'host2', status: 'COMPLETED'}}
            ]
          },
          e: {
            hosts: {
              host1: {progress: '33'},
              host2: {progress: '33'}
            },
            progress: '33'
          },
          m: 'Two hosts. One host without tasks. Second host has all tasks COMPLETED. Cluster status is PENDING'
        },
        {
          cluster: {status: 'PENDING'},
          hosts: Em.A([
            Em.Object.create({name: 'host1', status: '', message: '', progress: '', logTasks: []}),
            Em.Object.create({name: 'host2', status: '', message: '', progress: '', logTasks: []})
          ]),
          polledData: {
            tasks: [
              {Tasks: {host_name: 'host1', status: 'IN_PROGRESS'}},
              {Tasks: {host_name: 'host2', status: 'IN_PROGRESS'}}
            ]
          },
          e: {hosts: {host1: {progress: '12'}, host2: {progress: '12'}}, progress: '12'},
          m: 'Two hosts. Each host has one task IN_PROGRESS. Cluster status is PENDING'
        },
        {
          cluster: {status: 'PENDING'},
          hosts: Em.A([
            Em.Object.create({name: 'host1', status: '', message: '', progress: '', logTasks: []}),
            Em.Object.create({name: 'host2', status: '', message: '', progress: '', logTasks: []})
          ]),
          polledData: {
            tasks: [
              {Tasks: {host_name: 'host1', status: 'QUEUED'}},
              {Tasks: {host_name: 'host2', status: 'QUEUED'}}
            ]
          },
          e: {
            hosts: {
              host1: {progress: '3'},
              host2: {progress: '3'}
            },
            progress: '3'
          },
          m: 'Two hosts. Each host has one task QUEUED. Cluster status is PENDING'
        },
        {
          cluster: {status: 'INSTALLED'},
          hosts: Em.A([
            Em.Object.create({name: 'host1', status: '', message: '', progress: '', logTasks: []}),
            Em.Object.create({name: 'host2', status: '', message: '', progress: '', logTasks: []})
          ]),
          polledData: {
            tasks: [
              {Tasks: {host_name: 'host2', status: 'COMPLETED'}},
              {Tasks: {host_name: 'host2', status: 'COMPLETED'}}
            ]
          },
          e: {
            hosts: {
              host1: {progress: '100'},
              host2: {progress: '100'}
            },
            progress: '100'
          },
          m: 'Two hosts. One host without tasks. Second host has all tasks COMPLETED. Cluster status is INSTALLED'
        },
        {
          cluster: {status: 'INSTALLED'},
          hosts: Em.A([
            Em.Object.create({name: 'host1', status: '', message: '', progress: '', logTasks: []}),
            Em.Object.create({name: 'host2', status: '', message: '', progress: '', logTasks: []})
          ]),
          polledData: {
            tasks: [
              {Tasks: {host_name: 'host1', status: 'IN_PROGRESS'}},
              {Tasks: {host_name: 'host2', status: 'IN_PROGRESS'}}
            ]
          },
          e: {
            hosts: {
              host1: {progress: '58'},
              host2: {progress: '58'}
            },
            progress: '58'
          },
          m: 'Two hosts. Each host has one task IN_PROGRESS. Cluster status is INSTALLED'
        },
        {
          cluster: {status: 'INSTALLED'},
          hosts: Em.A([
            Em.Object.create({name: 'host1', status: '', message: '', progress: '', logTasks: []}),
            Em.Object.create({name: 'host2', status: '', message: '', progress: '', logTasks: []})
          ]),
          polledData: {
            tasks: [
              {Tasks: {host_name: 'host1', status: 'QUEUED'}},
              {Tasks: {host_name: 'host2', status: 'QUEUED'}}
            ]
          },
          e: {
            hosts: {
              host1: {progress: '40'},
              host2: {progress: '40'}
            },
            progress: '40'
          },
          m: 'Two hosts. Each host has one task QUEUED. Cluster status is INSTALLED'
        }
      ]);
      tests.forEach(function (test) {
        it(test.m, function () {
          var controller = App.WizardStep9Controller.create({hosts: test.hosts, content: {cluster: {status: test.cluster.status}}, finishState: function () {
            return false;
          }});
          var logTasksChangesCounter = controller.get('logTasksChangesCounter');
          controller.parseHostInfo(test.polledData);
          expect(controller.get('logTasksChangesCounter')).to.equal(logTasksChangesCounter + 1);
          for (var name in test.e.hosts) {
            if (test.e.hosts.hasOwnProperty(name)) {
              expect(controller.get('hosts').findProperty('name', name).get('progress')).to.equal(test.e.hosts[name].progress);
            }
          }
          expect(controller.get('progress')).to.equal(test.e.progress);
        });
      });
    });

    describe('#isAllComponentsInstalledSuccessCallback', function () {

      describe('', function() {
        var hosts = Em.A([
          Em.Object.create({name: 'host1', status: 'failed', expectedStatus: 'heartbeat_lost'}),
          Em.Object.create({name: 'host2', status: 'info', expectedStatus: 'heartbeat_lost'}),
          Em.Object.create({name: 'host3', status: 'warning', expectedStatus: 'warning'}),
          Em.Object.create({name: 'host4', status: 'info', expectedStatus: 'info'})
        ]);
        var heartbeatLostData = {
          "items": [
            {
              "Hosts": {
                "cluster_name": "c1",
                "host_name": "host1",
                "host_state": "HEARTBEAT_LOST"
              },
              "host_components": [
                {
                  "HostRoles": {
                    "cluster_name": "c1",
                    "component_name": "NAMENODE",
                    "host_name": "host1",
                    "state": "INSTALL_FAILED"
                  }
                }
              ]
            },
            {
              "Hosts": {
                "cluster_name": "c1",
                "host_name": "host2",
                "host_state": "HEARTBEAT_LOST"
              },
              "host_components": [
                {
                  "HostRoles": {
                    "cluster_name": "c1",
                    "component_name": "ZOOKEEPER_SERVER",
                    "host_name": "host2",
                    "state": "UNKNOWN"
                  }
                }
              ]
            },
            {
              "Hosts": {
                "cluster_name": "c1",
                "host_name": "host3",
                "host_state": "HEALTHY"
              },
              "host_components": [
                {
                  "HostRoles": {
                    "cluster_name": "c1",
                    "component_name": "DATANODE",
                    "host_name": "host3",
                    "state": "INSTALL_FAILED"
                  }
                }
              ]
            },
            {
              "Hosts": {
                "cluster_name": "c1",
                "host_name": "host4",
                "host_state": "HEALTHY"
              },
              "host_components": [
                {
                  "HostRoles": {
                    "cluster_name": "c1",
                    "component_name": "PIG",
                    "host_name": "host4",
                    "state": "INSTALLED"
                  }
                },
                {
                  "HostRoles": {
                    "cluster_name": "c1",
                    "component_name": "DATANODE",
                    "host_name": "host3",
                    "state": "INSTALLED"
                  }
                }
              ]
            }
          ]
        };

        var controller = App.WizardStep9Controller.create({hosts: hosts, content: {controllerName: 'installerController'}});

        App.testMode = true;
        // Action
        controller.isAllComponentsInstalledSuccessCallback(heartbeatLostData);


        // Validation  for the status of all hosts.
        controller.get('hosts').forEach(function (test) {
          var status = heartbeatLostData.items.findProperty('Hosts.host_name', test.get('name')).Hosts.host_state;
          it('Host "' + test.get('name') + '"' + ' with status "' + status + '" ', function () {
            expect(test.get('status')).to.equal(test.get('expectedStatus'));
          });
        });

      });

      describe('', function() {
        var noHeartbeatLostData = {
          "items": [
            {
              "Hosts": {
                "cluster_name": "c1",
                "host_name": "host1",
                "host_state": "HEALTHY"
              },
              "host_components": [
                {
                  "HostRoles": {
                    "cluster_name": "c1",
                    "component_name": "NAMENODE",
                    "host_name": "host1",
                    "state": "INSTALL_FAILED"
                  }
                }
              ]
            }
          ]
        };

        var hosts = Em.A([Em.Object.create({name: 'host1', status: 'failed'})]);
        // When there is no heartbeat lost for any host and cluster failed install task, Refreshing the page should not launch start all services request.
        // Below transitions are possibilities in this function
        // PENDING -> INSTALL or PENDING. This transition happens when install all services request is completed successfully.
        // INSTALL FAILED -> INSTALL FAILED. No transition should happen when install all services request fails and then user hits refresh
        // Cluster is not expected to enter this function in other states: INSTALLED, START FAILED, STARTED

        var statuses = Em.A(['INSTALL FAILED', 'INSTALLED','START FAILED', 'STARTED']);  // Cluster in any of this states should have no effect on the state from this function
        statuses.forEach(function (priorStatus) {
          var controller = App.WizardStep9Controller.create({hosts: hosts, content: {controllerName: 'installerController', cluster: {status: priorStatus}},togglePreviousSteps: function(){}});
          // Action
          controller.isAllComponentsInstalledSuccessCallback(noHeartbeatLostData);
          // Validation for the cluster state.
          var actualStatus = controller.get('content.cluster.status');
          it('Cluster state before entering the function "' + priorStatus + '"', function () {
            expect(actualStatus).to.equal(priorStatus);
          });
        });
      });
    });

     // isServicesInstalled is called after every poll for "Install All Services" request.
     // This function should result into a call to "Start All Services" request only if install request completed successfully.
    describe('#isServicesInstalled', function () {

      var hostStateJsonData =  {
        "items" : [
          {
            "Hosts" : {
              "cluster_name" : "c1",
              "host_name" : "ambari-1.c.apache.internal",
              "host_state" : "HEALTHY"
            },
            "host_components" : [
              {
                "HostRoles" : {
                  "cluster_name" : "c1",
                  "component_name" : "GANGLIA_MONITOR",
                  "host_name" : "ambari-1.c.apache.internal",
                  "state" : "STARTED"
                }
              }
            ]
          }
        ]
      };
      var hosts = Em.A([Em.Object.create({name: 'host1', progress: '33', status: 'info'}),
                        Em.Object.create({name: 'host2', progress: '33', status: 'info'})]);
      // polledData has all hosts with status completed to trigger transition from install->start request.
      var polledData =  Em.A([Em.Object.create({Tasks: {name: 'host1', status: 'COMPLETED'}}),
                              Em.Object.create({Tasks: {name: 'host2', status: 'COMPLETED'}})]);
      var controller = App.WizardStep9Controller.create({hosts: hosts, content: {controllerName: 'installerController',
                                                         cluster: {status: 'PENDING',name: 'c1'}},launchStartServices: function() {return true;}});
      var tests = Em.A([
        // controller has "status" value as "info" initially. If no errors are encountered then wizard stages
        // transition info->success, on error info->error, on warning info->warning
        {status: 'info' , e:{startServicesCalled:true}, m:'If no failed tasks then start services request should be called'},
        {status: 'failed', e:{startServicesCalled:false}, m: 'If install request has failed tasks then start services call should not be called'}
      ]);

      beforeEach(function() {
        App.testMode = true;
        sinon.spy(controller, 'launchStartServices');
        sinon.stub($, 'ajax').yieldsTo('success', hostStateJsonData);
      });

      afterEach(function() {
        App.testMode = false;
        controller.launchStartServices.restore();
        $.ajax.restore();
      });

      tests.forEach(function(test){
        it(test.m, function() {
          controller.set('status',test.status);
          //Action
          controller.isServicesInstalled(polledData);
          //Validation
           expect(controller.launchStartServices.called).to.equal(test.e.startServicesCalled);
        });
      });
    });

    // On completion of Start all services error callback function,
    // Cluster Status should be INSTALL FAILED
    // All progress bar on the screen should be finished (100%) with blue color.
    // Retry button should be enabled, next button should be disabled

    describe('#launchStartServicesErrorCallback', function () {
      App.testMode = true;
      // override the actual function
      App.popup = {
        setErrorPopup: function() {
          return true;
        }
      };
      var hosts = Em.A([Em.Object.create({name: 'host1', progress: '33', status: 'info'}),Em.Object.create({name: 'host2', progress: '33', status: 'info'})]);
      var controller = App.WizardStep9Controller.create({hosts: hosts, content: {controllerName: 'installerController', cluster: {status: 'PENDING',name: 'c1'}},togglePreviousSteps: function(){}});

      //Action
      controller.launchStartServicesErrorCallback({status:500, statusTesxt: 'Server Error'});
      it('Cluster Status should be INSTALL FAILED', function () {
        expect(controller.get('content.cluster.status')).to.equal('INSTALL FAILED');
      });

      it('Main progress bar on the screen should be finished (100%) with red color', function () {
        expect(controller.get('progress')).to.equal('100');
        expect(controller.get('status')).to.equal('failed');
      });

      it('All Host progress bars on the screen should be finished (100%) with blue color', function () {
        controller.get('hosts').forEach(function(host){
          expect(host.get('progress')).to.equal('100');
          expect(host.get('status')).to.equal('info');
        });
      });

      it('Next button should be disabled', function () {
        expect(controller.get('isSubmitDisabled')).to.equal(true);
      });

      it('Retry button should be visible', function () {
        expect(controller.get('showRetry')).to.equal(true);
      })

    });

  });
  
});
window.require.register("test/login_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('controllers/login_controller');

  describe('App.LoginController', function () {

    var loginController = App.LoginController.create();

    describe('#validateCredentials()', function () {
      /*
      it('should return undefined if no username is present', function () {
        loginController.set('loginName', '');
        expect(loginController.validateCredentials()).to.equal(undefined);
      })
      it('should return undefined if no password is present', function () {
        loginController.set('password', '');
        expect(loginController.validateCredentials()).to.equal(undefined);
      })
      it('should return the user object with the specified username and password (dummy until actual integration)', function () {
        loginController.set('loginName', 'admin');
        loginController.set('password', 'admin');
        expect(loginController.validateCredentials().get('loginName'), 'admin');
      })
      */
    })
  });
  
});
window.require.register("test/mappers/hosts_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('models/host');
  require('models/host_component');
  require('mappers/server_data_mapper');
  require('mappers/hosts_mapper');

  describe('App.hostsMapper', function () {



  });
  
});
window.require.register("test/mappers/jobs_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('views/main/apps/item/dag_view');
  require('mappers/server_data_mapper');
  require('mappers/jobs_mapper');

  describe('App.jobTimeLineMapper', function () {

    var test_input = {
      "map": [
        {
          "x": 1369394950,
          "y": 0
        },
        {
          "x": 1369394951,
          "y": 1
        },
        {
          "x": 1369394952,
          "y": 1
        },
        {
          "x": 1369394953,
          "y": 0
        }
      ],
      "shuffle": [
        {
          "x": 1369394950,
          "y": 0
        },
        {
          "x": 1369394951,
          "y": 0
        },
        {
          "x": 1369394952,
          "y": 1
        },
        {
          "x": 1369394953,
          "y": 1
        }
      ],
      "reduce": [
        {
          "x": 1369394950,
          "y": 0
        },
        {
          "x": 1369394951,
          "y": 0
        },
        {
          "x": 1369394952,
          "y": 0
        },
        {
          "x": 1369394953,
          "y": 0
        }
      ]
    };

    describe('#coordinatesModify()', function () {
      it('map', function() {
        var new_map = App.jobTimeLineMapper.coordinatesModify(test_input.map);
        expect(new_map.length).to.equal(6);

        expect(new_map[1].y).to.equal(new_map[0].y);
        expect(new_map[2].x).to.equal(new_map[1].x);

        expect(new_map[4].y).to.equal(new_map[5].y);
        expect(new_map[3].x).to.equal(new_map[4].x);
      });
      it('shuffle', function() {
        var new_shuffle = App.jobTimeLineMapper.coordinatesModify(test_input.shuffle);
        expect(new_shuffle.length).to.equal(6);

        expect(new_shuffle[2].y).to.equal(new_shuffle[1].y);
        expect(new_shuffle[3].x).to.equal(new_shuffle[2].x);

        expect(new_shuffle[3].y).to.equal(new_shuffle[4].y);
        expect(new_shuffle[4].x).to.equal(new_shuffle[5].x);
      });
      it('reduce', function() {
        var new_reduce = App.jobTimeLineMapper.coordinatesModify(test_input.reduce);
        expect(new_reduce.length).to.equal(4);
      });
    });
  });
  
});
window.require.register("test/mappers/runs_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('mappers/server_data_mapper');
  require('mappers/runs_mapper');

  describe('App.runsMapper', function () {

    var tests = [
      {
        i: {
          "workflowContext": {
            "workflowDag": {
              "entries": [
                {
                  "source": "scope-5",
                  "targets": []
                }
              ]
            }
          }
        },
        index: 0,
        e: '{dag: {"scope-5": []}}',
        m: 'One entry. Without targets'
      },
      {
        i: {
          "workflowContext": {
            "workflowDag": {
              "entries": [
                {
                  "source": "scope-5",
                  "targets": ['t1']
                }
              ]
            }
          }
        },
        index: 0,
        e: '{dag: {"scope-5": ["t1"]}}',
        m: 'One entry. With one target'
      },
      {
        i: {
          "workflowContext": {
            "workflowDag": {
              "entries": [
                {
                  "source": "scope-5",
                  "targets": ['t1,t2,t3']
                }
              ]
            }
          }
        },
        index: 0,
        e: '{dag: {"scope-5": ["t1,t2,t3"]}}',
        m: 'One entry. With multiple targets'
      },
      {
        i: {
          "workflowContext": {
            "workflowDag": {
              "entries": [
                {
                  "source": "scope-5",
                  "targets": []
                },
                {
                  "source": "scope-4",
                  "targets": []
                }
              ]
            }
          }
        },
        index: 0,
        e: '{dag: {"scope-5": [],"scope-4": []}}',
        m: 'Two entries. Without targets'
      },
      {
        i: {
          "workflowContext": {
            "workflowDag": {
              "entries": [
                {
                  "source": "scope-5",
                  "targets": ['t1,t2,t3']
                },
                {
                  "source": "scope-4",
                  "targets": ['t1']
                }
              ]
            }
          }
        },
        index: 0,
        e: '{dag: {"scope-5": ["t1,t2,t3"],"scope-4": ["t1"]}}',
        m: 'Two entries. With multiple targets'
      },
      {
        i: {
          "workflowContext": {
            "workflowDag": {
              "entries": [
                {
                  "source": "scope-5",
                  "targets": ['t1,t2,t3']
                },
                {
                  "source": "scope-4",
                  "targets": ['t1,t2,t3']
                }
              ]
            }
          }
        },
        index: 0,
        e: '{dag: {"scope-5": ["t1,t2,t3"],"scope-4": ["t1,t2,t3"]}}',
        m: 'Two entries. With multiple targets'
      }
    ];

    describe('#generateWorkflow', function() {
      tests.forEach(function(test) {
        it (test.m, function() {
          var result = App.runsMapper.generateWorkflow(test.i, test.index);
          expect(result.workflowContext).to.equal(test.e);
          expect(result.index).to.equal(test.index + 1);
        });
      });
    });

  });
  
});
window.require.register("test/mappers/server_data_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('mappers/server_data_mapper');

  describe('App.QuickDataMapper', function () {

    var test_json = {
      a1: {
        b1: {
          c1: 'val1'
        },
        b2: 'val2',
        b3: [
          {
            c2: 'val4'
          },
          {
            c2: 'val5'
          },
          {
            c2: 'val1'
          }
        ]
      },
      a2: 'val3',
      item: {
        'key.dotted': 'val6'
      }
    };

    describe('#getJsonProperty', function() {
      var tests = [
        {i:'a1.b1.c1',e:'val1'},
        {i:'a1.b2',e:'val2'},
        {i:'a2',e:'val3'},
        {i:'a1.b3[0].c2',e:'val4'},
        {i:'a1.b3[1].c2',e:'val5'}
      ];
      tests.forEach(function(test) {
        it(test.i, function() {
          var mapper = App.QuickDataMapper.create();
          expect(mapper.getJsonProperty(test_json, test.i)).to.equal(test.e);
        });
      });
    });

    describe('#parseIt', function() {
      var config = {
        $a2: 'a2',
        f1: 'a1.b1.c1',
        f2: 'a1.b3[0].c2',
        f3: 'a1.b3',
        f4_key: 'a1.b3',
        f4_type: 'array',
        f4: {
          item: 'c2'
        },
        f5: 'item.["key.dotted"]'
      };
      var mapper = App.QuickDataMapper.create();
      var result = mapper.parseIt(test_json, config);
      it('Property starts with $', function() {
        expect(result.a2).to.equal('a2');
      });
      it('Multi-components path', function() {
        expect(result.f1).to.equal('val1');
      });
      it('Path with array index', function() {
        expect(result.f2).to.equal('val4');
      });
      it('Path returns array', function() {
        expect(result.f3.length).to.equal(3);
      });
      it('Generate array of json fields', function() {
        expect(result.f4).to.eql(['val1','val4','val5']);
      });
      it('Check value with dotted key', function() {
        expect(result.f5).to.eql('val6');
      });
    });

  });
  
});
window.require.register("test/mappers/service_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('utils/helper');
  require('mappers/server_data_mapper');
  require('mappers/service_metrics_mapper');

  describe('App.serviceMetricsMapper', function () {

    describe('#hbaseMapper', function() {

      it ('Round Average Load', function() {
        var tests = [
          {
            components: [
              {
                  ServiceComponentInfo: {
                    AverageLoad: 1.23456789,
                    component_name: "HBASE_MASTER",
                    RegionsInTransition : [ ]
                  }
                }
            ],
            e: '1.23'
          },
          {
            components: [
              {
                  ServiceComponentInfo: {
                    AverageLoad: 1.00,
                    component_name: "HBASE_MASTER",
                    RegionsInTransition : [ ]
                  }
                }
            ],
            e: '1.00'
          },
          {
            components: [
              {
                  ServiceComponentInfo: {
                    AverageLoad: 1,
                    component_name: "HBASE_MASTER",
                    RegionsInTransition : [ ]
                  }
                }
            ],
            e: '1.00'
          },
          {
            components: [
              {
                  ServiceComponentInfo: {
                    AverageLoad: 1.2,
                    component_name: "HBASE_MASTER",
                    RegionsInTransition : [ ]
                  }
                }
            ],
            e: '1.20'
          }
        ];
        tests.forEach(function(test) {
          var result = App.serviceMetricsMapper.hbaseMapper(test);
          expect(result.average_load).to.equal(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/mappers/status_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('mappers/server_data_mapper');
  require('mappers/status_mapper');

  describe('App.statusMapper', function () {


  });
  
});
window.require.register("test/mappers/users_mapper_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('mappers/server_data_mapper');
  require('mappers/users_mapper');

  describe('App.usersMapper', function () {

    describe('#isAdmin', function() {
      var tests = [
        {i:'user,admin',e:true,m:'has admin role'},
        {i:'admin,user',e:true,m:'has admin role'},
        {i:'user',e:false,m:'doesn\'t have admin role'}
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          expect(App.usersMapper.isAdmin(test.i)).to.equal(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/models/host_component_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/host_component');

  describe('App.HostComponentStatus', function() {

    describe('#getStatusesList', function() {

      it('allowed statuses', function() {
        var statuses = ["STARTED","STARTING","INSTALLED","STOPPING","INSTALL_FAILED","INSTALLING","UPGRADE_FAILED","UNKNOWN","DISABLED","INIT"];
        expect(App.HostComponentStatus.getStatusesList()).to.include.members(statuses);
        expect(statuses).to.include.members(App.HostComponentStatus.getStatusesList());
      });
    });

  });
});
window.require.register("test/models/host_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('models/host');

  describe('App.Host', function () {

    var data = [
      {
        id: 'host1',
        host_name: 'host1',
        memory: 200000,
        disk_total: 100.555,
        disk_free: 90.555,
        health_status: 'HEALTHY',
        last_heart_beat_time: (new Date()).getTime() - 18100000
      },
      {
        id: 'host2',
        host_name: 'host2',
        memory: 99999,
        disk_total: 90,
        disk_free: 90,
        health_status: 'HEALTHY',
        last_heart_beat_time: (new Date()).getTime() - 170000
      },
      {
        id: 'host3',
        host_name: 'host3',
        memory: 99999,
        disk_total: 99.999,
        disk_free: 0,
        health_status: 'UNKNOWN',
        last_heart_beat_time: (new Date()).getTime()
      }
    ];
    before(function() {
      App.set('testMode', false);
    });
    App.store.loadMany(App.Host, data);

    describe('#diskUsedFormatted', function () {

      it('host1 - 10GB ', function () {
        var host = App.Host.find().findProperty('hostName', 'host1');
        expect(host.get('diskUsedFormatted')).to.equal('10GB');
      });
      it('host2 - 0GB', function () {
        var host = App.Host.find().findProperty('hostName', 'host2');
        expect(host.get('diskUsedFormatted')).to.equal('0GB');
      });
      it('host3 - 100GB', function () {
        var host = App.Host.find().findProperty('hostName', 'host3');
        expect(host.get('diskUsedFormatted')).to.equal('100GB');
      });
    });

    describe('#diskTotalFormatted', function () {

      it('host1 - 100.56GB ', function () {
        var host = App.Host.find().findProperty('hostName', 'host1');
        expect(host.get('diskTotalFormatted')).to.equal('100.56GB');
      });
      it('host2 - 90GB', function () {
        var host = App.Host.find().findProperty('hostName', 'host2');
        expect(host.get('diskTotalFormatted')).to.equal('90GB');
      });
      it('host3 - 100GB', function () {
        var host = App.Host.find().findProperty('hostName', 'host3');
        expect(host.get('diskTotalFormatted')).to.equal('100GB');
      });
    });

    describe('#diskUsageFormatted', function () {

      it('host1 - 9.94% ', function () {
        var host = App.Host.find().findProperty('hostName', 'host1');
        expect(host.get('diskUsageFormatted')).to.equal('9.94%');
      });
      it('host2 - 0%', function () {
        var host = App.Host.find().findProperty('hostName', 'host2');
        expect(host.get('diskUsageFormatted')).to.equal('0%');
      });
      it('host3 - 100%', function () {
        var host = App.Host.find().findProperty('hostName', 'host3');
        expect(host.get('diskUsageFormatted')).to.equal('100%');
      });
    });

    describe('#isNotHeartBeating', function () {
      it('host2 - false', function () {
        var host = App.Host.find().findProperty('hostName', 'host2');
        expect(host.get('isNotHeartBeating')).to.equal(false);
      });
      it('host3 - false', function () {
        var host = App.Host.find().findProperty('hostName', 'host3');
        expect(host.get('isNotHeartBeating')).to.equal(true);
      });
    });

  });
  
});
window.require.register("test/models/rack_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('models/host');
  require('models/rack');

  describe('App.Rack', function () {

    var data = {
      id: 'rack1',
      name: 'rack1'
    };

    App.store.load(App.Rack, data);

    describe('#liveHostsCount', function () {

      it('rack1 has two live hosts', function () {
        var rack = App.Rack.find().findProperty('name', 'rack1');
        expect(rack.get('liveHostsCount')).to.equal(2);
      });

      it('rack1 has three live hosts', function () {
        App.store.load(App.Host, {
          id: 'host3',
          host_name: 'host3',
          health_status: 'HEALTHY'
        });
        var rack = App.Rack.find().findProperty('name', 'rack1');
        rack.set('name', 'rack1');
        expect(rack.get('liveHostsCount')).to.equal(3);
      });
    });


  });
  
});
window.require.register("test/utils/ajax_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('utils/ajax');

  describe('App.ajax', function() {

    beforeEach(function() {
      App.set('apiPrefix', '/api/v1');
      App.set('clusterName', 'tdk');
      sinon.spy($, 'ajax');
    });

    afterEach(function() {
      $.ajax.restore();
    });

    describe('#send', function() {

      it('Without sender', function() {
        expect(App.ajax.send({})).to.equal(null);
        expect($.ajax.called).to.be.false;
      });

      it('Invalid config.name', function() {
        expect(App.ajax.send({name:'fake_name', sender: this})).to.equal(null);
        expect($.ajax.called).to.be.false;
      });

      it('With proper data', function() {
        App.ajax.send({name: 'router.logoff', sender: this});
        expect($.ajax.calledOnce).to.be.true;
      });

    });

    describe('#formatUrl', function() {

      var tests = [
        {
          url: null,
          data: {},
          e: null,
          m: 'url is null'
        },
        {
          url: 'site/{param}',
          data: null,
          e: 'site/',
          m: 'url with one param, but data is null'
        },
        {
          url: 'clean_url',
          data: {},
          e: 'clean_url',
          m: 'url without placeholders'
        },
        {
          url: 'site/{param}',
          data: {},
          e: 'site/',
          m: 'url with param, but there is no such param in the data'
        },
        {
          url: 'site/{param}/{param}',
          data: {param: 123},
          e: 'site/123/123',
          m: 'url with param which appears two times'
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          var r = App.ajax.fakeFormatUrl(test.url, test.data);
          expect(r).to.equal(test.e);
        });
      });
    });

    describe('Check "real" and "mock" properties for each url object', function() {
      var names = App.ajax.fakeGetUrlNames();
      names.forEach(function(name) {
        it(name, function() {
          var url = App.ajax.fakeGetUrl(name);
          expect(url.real).to.be.a('string');
          expect(url.real.length > 0).to.equal(true);
          expect(url.mock).to.be.a('string');
        });
      });
    });

    describe('#formatRequest', function() {

      beforeEach(function() {
        App.testMode = false;
      });
      afterEach(function() {
        App.testMode = true;
      });

      it('App.testMode = true', function() {
        App.testMode = true;
        var r = App.ajax.fakeFormatRequest({real:'/', mock: '/some_url'}, {});
        expect(r.type).to.equal('GET');
        expect(r.url).to.equal('/some_url');
        expect(r.dataType).to.equal('json');
      });
      var tests = [
        {
          urlObj: {
            real: '/real_url',
            format: function() {
              return {
                type: 'PUT'
              }
            }
          },
          data: {},
          m: '',
          e: {type: 'PUT', url: '/api/v1/real_url'}
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          var r = App.ajax.fakeFormatRequest(test.urlObj, test.data);
          expect(r.type).to.equal(test.e.type);
          expect(r.url).to.equal(test.e.url);
        });
      });
    });

  });
  
});
window.require.register("test/utils/batch_scheduled_requests_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('utils/helper');
  require('views/common/rolling_restart_view');
  var batchUtils = require('utils/batch_scheduled_requests');

  describe('batch_scheduled_requests', function() {

    describe('#getRollingRestartComponentName', function() {
      var tests = [
        {serviceName: 'HDFS', componentName: 'DATANODE'},
        {serviceName: 'YARN', componentName: 'NODEMANAGER'},
        {serviceName: 'MAPREDUCE', componentName: 'TASKTRACKER'},
        {serviceName: 'HBASE', componentName: 'HBASE_REGIONSERVER'},
        {serviceName: 'STORM', componentName: 'SUPERVISOR'},
        {serviceName: 'SOME_INVALID_SERVICE', componentName: null}
      ];

      tests.forEach(function(test) {
        it(test.serviceName + ' - ' + test.componentName, function() {
          expect(batchUtils.getRollingRestartComponentName(test.serviceName)).to.equal(test.componentName);
        });
      });

    });

    describe('#getBatchesForRollingRestartRequest', function() {
      var tests = [
        {
          hostComponents: Em.A([
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host1'}}),
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host2'}}),
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host3'}})
          ]),
          batchSize: 2,
          m: 'DATANODES on three hosts, batchSize = 2',
          e: {
            batchCount: 2
          }
        },
        {
          hostComponents: Em.A([
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host1'}}),
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host2'}}),
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host3'}})
          ]),
          batchSize: 3,
          m: 'DATANODES on 3 hosts, batchSize = 3',
          e: {
            batchCount: 1
          }
        },
        {
          hostComponents: Em.A([
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host1'}}),
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host2'}}),
            Em.Object.create({componentName:'DATANODE', service:{serviceName:'HDFS'}, host:{hostName:'host3'}})
          ]),
          batchSize: 1,
          m: 'DATANODES on 3 hosts, batchSize = 1',
          e: {
            batchCount: 3
          }
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          expect(batchUtils.getBatchesForRollingRestartRequest(test.hostComponents, test.batchSize).length).to.equal(test.e.batchCount);
        });
      });
    });

    describe('#launchHostComponentRollingRestart', function() {

      beforeEach(function() {
        sinon.spy(batchUtils, 'showRollingRestartPopup');
        sinon.spy(batchUtils, 'showWarningRollingRestartPopup');
      });

      afterEach(function() {
        batchUtils.showRollingRestartPopup.restore();
        batchUtils.showWarningRollingRestartPopup.restore();
      });

      var tests = Em.A([
        {componentName: 'DATANODE', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
        {componentName: 'TASKTRACKER', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
        {componentName: 'NODEMANAGER', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
        {componentName: 'HBASE_REGIONSERVER', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
        {componentName: 'SUPERVISOR', e:{showRollingRestartPopup:true, showWarningRollingRestartPopup:false}},
        {componentName: 'SOME_OTHER_COMPONENT', e:{showRollingRestartPopup:false, showWarningRollingRestartPopup:true}}
      ]);

      tests.forEach(function(test) {
        it(test.componentName, function() {
          batchUtils.launchHostComponentRollingRestart(test.componentName);
          expect(batchUtils.showRollingRestartPopup.calledOnce).to.equal(test.e.showRollingRestartPopup);
          expect(batchUtils.showWarningRollingRestartPopup.calledOnce).to.equal(test.e.showWarningRollingRestartPopup);
        });
      });

    });

    describe('#restartHostComponents', function() {

      beforeEach(function() {
        sinon.spy($, 'ajax');
        App.testMode = true;
      });

      afterEach(function() {
        $.ajax.restore();
        App.testMode = false;
      });

      var tests = Em.A([
        {
          hostComponentList: Em.A([
            Em.Object.create({
              componentName: 'n1',
              host: Em.Object.create({
                hostName: 'h1'
              })
            }),
            Em.Object.create({
              componentName: 'n1',
              host: Em.Object.create({
                hostName: 'h2'
              })
            })
          ]),
          e: {
            ajaxCalledOnce: true,
            resource_filters: [{"component_name":"n1","hosts":"h1,h2"}]
          },
          m: '1 component on 2 hosts'
        },
        {
          hostComponentList: Em.A([
            Em.Object.create({
              componentName: 'n1',
              host: Em.Object.create({
                hostName: 'h1'
              })
            }),
            Em.Object.create({
              componentName: 'n1',
              host: Em.Object.create({
                hostName: 'h2'
              })
            }),
            Em.Object.create({
              componentName: 'n2',
              host: Em.Object.create({
                hostName: 'h2'
              })
            })
          ]),
          e: {
            ajaxCalledOnce: true,
            resource_filters: [{"component_name":"n1","hosts":"h1,h2"},{"component_name":"n2","hosts":"h2"}]
          },
          m: '1 component on 2 hosts, 1 on 1 host'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          batchUtils.restartHostComponents(test.hostComponentList);
          expect($.ajax.calledOnce).to.equal(test.e.ajaxCalledOnce);
          expect( JSON.parse($.ajax.args[0][0].data)['Requests/resource_filters']).to.eql(test.e.resource_filters);
        });
      });

      it('Empty data', function() {
        batchUtils.restartHostComponents([]);
        expect($.ajax.called).to.equal(false);
      });

    });

  });
  
});
window.require.register("test/utils/config_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('config');
  require('utils/config');

  describe('App.config', function () {

    App.supports.capacitySchedulerUi = true;

    describe('#identifyCategory', function () {
      var data = {};
      it('should return null if config doesn\'t have category', function () {
        expect(App.config.identifyCategory(data)).to.equal(null);
      });
      it('should return "AdvancedCoreSite" if filename "core-site.xml" and serviceName "HDFS"', function () {
        data = {
          serviceName: 'HDFS',
          filename: 'core-site.xml'
        };
        expect(App.config.identifyCategory(data).name).to.equal('AdvancedCoreSite');
      });
      it('should return "CapacityScheduler" if filename "capacity-scheduler.xml" and serviceName "YARN"', function () {
        data = {
          serviceName: 'YARN',
          filename: 'capacity-scheduler.xml'
        };
        expect(App.config.identifyCategory(data).name).to.equal('CapacityScheduler');
      });
    });

    describe('#handleSpecialProperties', function () {
      var config = {};
      it('value should be transformed to "1024" from "1024m"', function () {
        config = {
          displayType: 'int',
          value: '1024m',
          defaultValue: '1024m'
        };
        App.config.handleSpecialProperties(config);
        expect(config.value).to.equal('1024');
        expect(config.defaultValue).to.equal('1024');
      });
      it('value should be transformed to true from "true"', function () {
        config = {
          displayType: 'checkbox',
          value: 'true',
          defaultValue: 'true'
        };
        App.config.handleSpecialProperties(config);
        expect(config.value).to.equal(true);
        expect(config.defaultValue).to.equal(true);
      });
      it('value should be transformed to false from "false"', function () {
        config = {
          displayType: 'checkbox',
          value: 'false',
          defaultValue: 'false'
        };
        App.config.handleSpecialProperties(config);
        expect(config.value).to.equal(false);
        expect(config.defaultValue).to.equal(false);
      });
    });

    describe('#calculateConfigProperties', function () {
      var config = {};
      var isAdvanced = false;
      var advancedConfigs = [];
      it('isUserProperty should be true if config is custom(site.xml) and not advanced', function () {
        config = {
          serviceName: 'HDFS',
          filename: 'core-site.xml'
        };
        App.config.calculateConfigProperties(config, isAdvanced, advancedConfigs);
        expect(config.isUserProperty).to.equal(true);
      });

      it('isUserProperty should be false if config from "capacity-scheduler.xml" or "mapred-queue-acls.xml" ', function () {
        config = {
          name: 'test',
          serviceName: 'MAPREDUCE',
          filename: 'capacity-scheduler.xml',
          isUserProperty: false
        };
        isAdvanced = true;
        App.config.calculateConfigProperties(config, isAdvanced, advancedConfigs);
        expect(config.isUserProperty).to.equal(false);
      });

      it('isRequired should be false if config is advanced"', function () {
        config = {
          name: 'test',
          serviceName: 'HDFS',
          filename: 'core-site.xml'
        };
        isAdvanced = true;
        advancedConfigs = [{name:'test', filename: 'core-site.xml'}];
        App.config.calculateConfigProperties(config, isAdvanced, advancedConfigs);
        expect(config.category).to.equal('Advanced');
        expect(config.isRequired).to.equal(true);
        expect(config.filename).to.equal('core-site.xml');
      });
    });

    describe('#fileConfigsIntoTextarea', function () {
      var filename = 'capacity-scheduler.xml';
      var configs = [
        {
          name: 'config1',
          value: 'value1',
          defaultValue: 'value1',
          filename: 'capacity-scheduler.xml'
        },
        {
          name: 'config2',
          value: 'value2',
          defaultValue: 'value2',
          filename: 'capacity-scheduler.xml'
        }
      ];
      it('two configs into textarea', function () {
        var result = App.config.fileConfigsIntoTextarea.call(App.config, configs, filename);
        expect(result.length).to.equal(1);
        expect(result[0].value).to.equal('config1=value1\nconfig2=value2\n');
        expect(result[0].defaultValue).to.equal('config1=value1\nconfig2=value2\n');
      });
      it('three config into textarea', function () {
        configs.push({
          name: 'config3',
          value: 'value3',
          defaultValue: 'value3',
          filename: 'capacity-scheduler.xml'
        });
        var result = App.config.fileConfigsIntoTextarea.call(App.config, configs, filename);
        expect(result.length).to.equal(1);
        expect(result[0].value).to.equal('config1=value1\nconfig2=value2\nconfig3=value3\n');
        expect(result[0].defaultValue).to.equal('config1=value1\nconfig2=value2\nconfig3=value3\n');
      });
      it('one of three configs has different filename', function () {
        configs[1].filename = 'another filename';
        var result = App.config.fileConfigsIntoTextarea.call(App.config, configs, filename);
        //result contains two configs: one with different filename and one textarea config
        expect(result.length).to.equal(2);
        expect(result[1].value).to.equal('config1=value1\nconfig3=value3\n');
        expect(result[1].defaultValue).to.equal('config1=value1\nconfig3=value3\n');
      });
      it('none configs into empty textarea', function () {
        filename = 'capacity-scheduler.xml';
        configs.clear();
        var result = App.config.fileConfigsIntoTextarea.call(App.config, configs, filename);
        expect(result.length).to.equal(1);
        expect(result[0].value).to.equal('');
        expect(result[0].defaultValue).to.equal('');
      });

    });

    describe('#textareaIntoFileConfigs', function () {
      var filename = 'capacity-scheduler.xml';
      var testData = [
        {
          configs: [Em.Object.create({
            "name": "capacity-scheduler",
            "value": "config1=value1",
            "filename": "capacity-scheduler.xml"
          })]
        },
        {
          configs: [Em.Object.create({
            "name": "capacity-scheduler",
            "value": "config1=value1\nconfig2=value2\n",
            "filename": "capacity-scheduler.xml"
          })]
        },
        {
          configs: [Em.Object.create({
            "name": "capacity-scheduler",
            "value": "config1=value1,value2\n",
            "filename": "capacity-scheduler.xml"
          })]
        },
        {
          configs: [Em.Object.create({
            "name": "capacity-scheduler",
            "value": "config1=value1 config2=value2\n",
            "filename": "capacity-scheduler.xml"
          })]
        }
      ];

      it('config1=value1 to one config', function () {
        var result = App.config.textareaIntoFileConfigs.call(App.config, testData[0].configs, filename);
        expect(result.length).to.equal(1);
        expect(result[0].value).to.equal('value1');
        expect(result[0].name).to.equal('config1');
      });
      it('config1=value1\\nconfig2=value2\\n to two configs', function () {
        var result = App.config.textareaIntoFileConfigs.call(App.config, testData[1].configs, filename);
        expect(result.length).to.equal(2);
        expect(result[0].value).to.equal('value1');
        expect(result[0].name).to.equal('config1');
        expect(result[1].value).to.equal('value2');
        expect(result[1].name).to.equal('config2');
      });
      it('config1=value1,value2\n to one config', function () {
        var result = App.config.textareaIntoFileConfigs.call(App.config, testData[2].configs, filename);
        expect(result.length).to.equal(1);
        expect(result[0].value).to.equal('value1,value2');
        expect(result[0].name).to.equal('config1');
      });
      it('config1=value1 config2=value2 to two configs', function () {
        var result = App.config.textareaIntoFileConfigs.call(App.config, testData[3].configs, filename);
        expect(result.length).to.equal(1);
      });
    });

    describe('#escapeXMLCharacters', function () {

      var testConfigs = [
        {
          html: '&>"',
          json: '&>"'
        },
        {
          html: '&amp;&gt;&quot;&apos;',
          json: '&>"\''
        },
        {
          html: '&&gt;',
          json: '&>'
        },
        {
          html: '&&&amp;',
          json: '&&&'
        },
        {
          html: 'LD_LIBRARY_PATH=/usr/lib/hadoop/lib/native:/usr/lib/hadoop/lib/native/`$JAVA_HOME/bin/java -d32 -version &amp;&gt; /dev/null;if [ $? -eq 0 ]; then echo Linux-i386-32; else echo Linux-amd64-64;fi`',
          json: 'LD_LIBRARY_PATH=/usr/lib/hadoop/lib/native:/usr/lib/hadoop/lib/native/`$JAVA_HOME/bin/java -d32 -version &> /dev/null;if [ $? -eq 0 ]; then echo Linux-i386-32; else echo Linux-amd64-64;fi`'
        }
      ];
      testConfigs.forEach(function(t){
        it('parsing html ' + t.html, function () {
          expect(t.json).to.equal(App.config.escapeXMLCharacters(t.html));
        });
      });

    });
  });
});
window.require.register("test/utils/configs/defaults_providers/hive_defaults_provider_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('utils/configs/defaults_providers/defaultsProvider');
  require('utils/configs/defaults_providers/yarn_defaults_provider');

  describe('HiveDefaultsProvider', function() {

    describe('#getDefaults', function() {
      var tests = [
        {
          localDB: {},
          m: 'Empty localDB',
          e: null
        },
        {
          localDB: {
            "masterComponentHosts": []
          },
          m: 'localDB without hosts',
          e: null
        },
        {
          localDB: {
            "hosts": {}
          },
          m: 'localDB without masterComponentHosts amd slaveComponentHosts',
          e: null
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'Without HBase',
          e: {
            'mapreduce.map.java.opts': '-Xmx1024m',
            'mapreduce.map.memory.mb': 1280,
            'mapreduce.reduce.java.opts': '-Xmx2048m',
            'mapreduce.reduce.memory.mb': 2560,
            'yarn.app.mapreduce.am.command-opts': '-Xmx2048m',
            'yarn.app.mapreduce.am.resource.mb': 2560,
            'yarn.nodemanager.resource.memory-mb': 20480,
            'yarn.scheduler.maximum-allocation-mb': 20480,
            'yarn.scheduler.minimum-allocation-mb': 2560,
            'mapreduce.task.io.sort.mb': 512,
            'hive.tez.container.size': 2560
          }
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "12582912.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [
              {"component": "HBASE_MASTER","hostName": "host1","serviceId": "HDFS"}
            ],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'With HBase (low memory - pick mapreduce.reduce.memory.mb)',
          e: {
            'mapreduce.map.java.opts': '-Xmx410m',
            'mapreduce.map.memory.mb': 512,
            'mapreduce.reduce.java.opts': '-Xmx819m',
            'mapreduce.reduce.memory.mb': 1024,
            'yarn.app.mapreduce.am.command-opts': '-Xmx819m',
            'yarn.app.mapreduce.am.resource.mb': 1024,
            'yarn.nodemanager.resource.memory-mb': 8192,
            'yarn.scheduler.maximum-allocation-mb': 8192,
            'yarn.scheduler.minimum-allocation-mb': 1024,
            'mapreduce.task.io.sort.mb': 205,
            'hive.tez.container.size': 1024
          }
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "100165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "100165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [
              {"component": "HBASE_MASTER","hostName": "host1","serviceId": "HDFS"}
            ],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'With HBase (high memory - pick mapreduce.map.memory.mb)',
          e: {
            'mapreduce.map.java.opts': '-Xmx3482m',
            'mapreduce.map.memory.mb': 4352,
            'mapreduce.reduce.java.opts': '-Xmx6963m',
            'mapreduce.reduce.memory.mb': 8704,
            'yarn.app.mapreduce.am.command-opts': '-Xmx6963m',
            'yarn.app.mapreduce.am.resource.mb': 8704,
            'yarn.nodemanager.resource.memory-mb': 69632,
            'yarn.scheduler.maximum-allocation-mb': 69632,
            'yarn.scheduler.minimum-allocation-mb': 8704,
            'mapreduce.task.io.sort.mb': 1024,
            'hive.tez.container.size': 4352
          }
        }
      ];
      var defaultsProvider = App.HiveDefaultsProvider.create();
      tests.forEach(function(test) {
        it(test.m, function() {
          defaultsProvider.set('clusterData', null);
          var configs = defaultsProvider.getDefaults(test.localDB);
          for(var config in configs) {
            if (test.e) {
              expect(configs[config]).to.equal(test.e[config]);
            }
            else {
              expect(configs[config] == 0 || configs[config] == null).to.equal(true);
            }
          }
        });
      });
    });

  });
  
});
window.require.register("test/utils/configs/defaults_providers/tez_defaults_provider_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('utils/configs/defaults_providers/defaultsProvider');
  require('utils/configs/defaults_providers/yarn_defaults_provider');

  describe('TezDefaultsProvider', function() {

    describe('#getDefaults', function() {
      var tests = [
        {
          localDB: {},
          m: 'Empty localDB',
          e: null
        },
        {
          localDB: {
            "masterComponentHosts": []
          },
          m: 'localDB without hosts',
          e: null
        },
        {
          localDB: {
            "hosts": {}
          },
          m: 'localDB without masterComponentHosts amd slaveComponentHosts',
          e: null
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'Without HBase',
          e: {
            'mapreduce.map.java.opts': '-Xmx1024m',
            'mapreduce.map.memory.mb': 1280,
            'mapreduce.reduce.java.opts': '-Xmx2048m',
            'mapreduce.reduce.memory.mb': 2560,
            'yarn.app.mapreduce.am.command-opts': '-Xmx2048m',
            'yarn.app.mapreduce.am.resource.mb': 2560,
            'yarn.nodemanager.resource.memory-mb': 20480,
            'yarn.scheduler.maximum-allocation-mb': 20480,
            'yarn.scheduler.minimum-allocation-mb': 2560,
            'mapreduce.task.io.sort.mb': 512,
            'tez.am.resource.memory.mb': 2560,
            'tez.am.java.opts': '-server -Xmx2048m -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC'
          }
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "12582912.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [
              {"component": "HBASE_MASTER","hostName": "host1","serviceId": "HDFS"}
            ],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'With HBase',
          e: {
            'mapreduce.map.java.opts': '-Xmx410m',
            'mapreduce.map.memory.mb': 512,
            'mapreduce.reduce.java.opts': '-Xmx819m',
            'mapreduce.reduce.memory.mb': 1024,
            'yarn.app.mapreduce.am.command-opts': '-Xmx819m',
            'yarn.app.mapreduce.am.resource.mb': 1024,
            'yarn.nodemanager.resource.memory-mb': 8192,
            'yarn.scheduler.maximum-allocation-mb': 8192,
            'yarn.scheduler.minimum-allocation-mb': 1024,
            'mapreduce.task.io.sort.mb': 205,
            'tez.am.resource.memory.mb': 1024,
            'tez.am.java.opts': '-server -Xmx819m -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC'
          }
        }
      ];
      var defaultsProvider = App.TezDefaultsProvider.create();
      tests.forEach(function(test) {
        it(test.m, function() {
          defaultsProvider.set('clusterData', null);
          var configs = defaultsProvider.getDefaults(test.localDB);
          for ( var config in configs) {
            if (test.e) {
              expect(configs[config]).to.equal(test.e[config]);
            } else {
              expect(configs[config] == 0 || configs[config] == null).to.equal(true);
            }
          }
        });
      });
    });

  });
  
});
window.require.register("test/utils/configs/defaults_providers/yarn_defaults_provider_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('utils/configs/defaults_providers/defaultsProvider');
  require('utils/configs/defaults_providers/yarn_defaults_provider');

  var yarnDefaultProvider;

  describe('YARNDefaultsProvider', function() {

    beforeEach(function() {
      yarnDefaultProvider = App.YARNDefaultsProvider.create();
    });

    afterEach(function() {
      yarnDefaultProvider.set('clusterData', null);
      yarnDefaultProvider.set('reservedRam', null);
      yarnDefaultProvider.set('hBaseRam', null);
      yarnDefaultProvider.set('containers', null);
      yarnDefaultProvider.set('recommendedMinimumContainerSize', null);
      yarnDefaultProvider.set('ramPerContainer', null);
      yarnDefaultProvider.set('mapMemory', null);
      yarnDefaultProvider.set('reduceMemory', null);
      yarnDefaultProvider.set('amMemory', null);
    });

    describe('#clusterDataIsValid', function() {
      var tests = Em.A([
        {clusterData: {disk: 12,ram: 48,cpu: 12,hBaseInstalled: false},e: true},
        {clusterData: {disk: null,ram: 48,cpu: 12,hBaseInstalled: false},e: false},
        {clusterData: {disk: 12,ram: null,cpu: 12,hBaseInstalled: false},e: false},
        {clusterData: {disk: 12,ram: 48,cpu: null,hBaseInstalled: false},e: false},
        {clusterData: {disk: 12,ram: 48,cpu: 12,hBaseInstalled: null},e: false},
        {clusterData: {disk: 12,ram: 48,cpu: 12},e: false},
        {clusterData: {disk: 12,ram: 48,hBaseInstalled: true},e: false},
        {clusterData: {disk: 12,cpu: 12,hBaseInstalled: true},e: false},
        {clusterData: {ram: 48,cpu: 12,hBaseInstalled: false},e: false}
      ]);
      tests.forEach(function(test) {
        it((test.e?'valid':'invalid') + ' clusterData', function() {
          yarnDefaultProvider.set('clusterData', test.clusterData);
          expect(yarnDefaultProvider.clusterDataIsValid()).to.equal(test.e);
        });
      });
    });

    describe('#reservedMemoryRecommendations', function() {
      var tests = Em.A([
        {ram: null, e: {os: 1, hbase: 1}},
        {ram: 2, e: {os: 1, hbase: 1}},
        {ram: 4, e: {os: 1, hbase: 1}},
        {ram: 6, e: {os: 2, hbase: 1}},
        {ram: 8, e: {os: 2, hbase: 1}},
        {ram: 12, e: {os: 2, hbase: 2}},
        {ram: 16, e: {os: 2, hbase: 2}},
        {ram: 20, e: {os: 4, hbase: 4}},
        {ram: 24, e: {os: 4, hbase: 4}},
        {ram: 36, e: {os: 6, hbase: 8}},
        {ram: 48, e: {os: 6, hbase: 8}},
        {ram: 56, e: {os: 8, hbase: 8}},
        {ram: 64, e: {os: 8, hbase: 8}},
        {ram: 68, e: {os: 8, hbase: 8}},
        {ram: 72, e: {os: 8, hbase: 8}},
        {ram: 84, e: {os: 12, hbase: 16}},
        {ram: 96, e: {os: 12, hbase: 16}},
        {ram: 112, e: {os: 24, hbase: 24}},
        {ram: 128, e: {os: 24, hbase: 24}},
        {ram: 196, e: {os: 32, hbase: 32}},
        {ram: 256, e: {os: 32, hbase: 32}},
        {ram: 384, e: {os: 64, hbase: 64}},
        {ram: 512, e: {os: 64, hbase: 64}},
        {ram: 756, e: {os: 64, hbase: 64}}
      ]);
      tests.forEach(function(test) {
        it('ram: ' + test.ram + ' GB', function() {
          sinon.spy(yarnDefaultProvider, 'reservedMemoryRecommendations');
          yarnDefaultProvider.set('clusterData', {
            disk: 12,
            ram: test.ram,
            cpu: 12,
            hBaseInstalled: false
          });
          expect(yarnDefaultProvider.get('reservedRam')).to.equal(test.e.os);
          expect(yarnDefaultProvider.get('hBaseRam')).to.equal(test.e.hbase);
          expect(yarnDefaultProvider.reservedMemoryRecommendations.calledOnce).to.equal(true);
          yarnDefaultProvider.reservedMemoryRecommendations.restore();
        });
      });
    });

    describe('#recommendedMinimumContainerSize', function() {
      it('No clusterData', function() {
        yarnDefaultProvider.set('clusterData', null);
        expect(yarnDefaultProvider.get('recommendedMinimumContainerSize')).to.equal(null);
      });
      it('No clusterData.ram', function() {
        yarnDefaultProvider.set('clusterData', {});
        expect(yarnDefaultProvider.get('recommendedMinimumContainerSize')).to.equal(null);
      });

      var tests = Em.A([
        {ram: 3, e: 256},
        {ram: 4, e: 256},
        {ram: 6, e: 512},
        {ram: 8, e: 512},
        {ram: 12, e: 1024},
        {ram: 24, e: 1024}
      ]);

      tests.forEach(function(test) {
        it('ram: ' + test.ram + ' GB', function() {
         yarnDefaultProvider.set('clusterData', {
            disk: 12,
            ram: test.ram,
            cpu: 12,
            hBaseInstalled: false
          });
          expect(yarnDefaultProvider.get('recommendedMinimumContainerSize')).to.equal(test.e);
        });
      });

    });

    describe('#containers', function() {
      it('No clusterData', function() {
        yarnDefaultProvider.set('clusterData', null);
        expect(yarnDefaultProvider.get('containers')).to.equal(null);
      });
      it('Some clusterData metric is null', function() {
        yarnDefaultProvider.set('clusterData', {disk: null, cpu: 1, ram: 1});
        expect(yarnDefaultProvider.get('containers')).to.equal(null);
        yarnDefaultProvider.set('clusterData', {disk: 1, cpu: null, ram: 1});
        expect(yarnDefaultProvider.get('containers')).to.equal(null);
        yarnDefaultProvider.set('clusterData', {disk:1, cpu: 1, ram: null});
        expect(yarnDefaultProvider.get('containers')).to.equal(null);
      });

      var tests = Em.A([
        {
          clusterData: {
            disk: 12,
            ram: 48,
            cpu: 12,
            hBaseInstalled: false
          },
          e: 21
        },
        {
          clusterData: {
            disk: 6,
            ram: 48,
            cpu: 6,
            hBaseInstalled: true
          },
          e: 11
        }
      ]);

      tests.forEach(function(test) {
        it((test.hBaseInstalled?'With':'Without') + ' hBase', function() {
          yarnDefaultProvider.set('clusterData', test.clusterData);
          expect(yarnDefaultProvider.get('containers')).to.equal(test.e);
        });
      });

    });

    describe('#ramPerContainer', function() {
      it('No clusterData', function() {
        yarnDefaultProvider.set('clusterData', null);
        expect(yarnDefaultProvider.get('ramPerContainer')).to.equal(null);
      });
      var tests = Em.A([
        {
          clusterData: {
            disk: 12,
            ram: 48,
            cpu: 12,
            hBaseInstalled: false
          },
          e: 2048
        },
        {
          clusterData: {
            disk: 12,
            ram: 16,
            cpu: 12,
            hBaseInstalled: true
          },
          e: 1024
        }
      ]);

      tests.forEach(function(test) {
        it((test.hBaseInstalled?'With':'Without') + ' hBase', function() {
          yarnDefaultProvider.set('clusterData', test.clusterData);
          expect(yarnDefaultProvider.get('ramPerContainer')).to.equal(test.e);
        });
      });
    });

    describe('#getDefaults', function() {
      var tests = Em.A([
        {
          localDB: {},
          m: 'Empty localDB',
          e: null
        },
        {
          localDB: {
            "masterComponentHosts": []
          },
          m: 'localDB without hosts',
          e: null
        },
        {
          localDB: {
            "hosts": {}
          },
          m: 'localDB without masterComponentHosts amd slaveComponentHosts',
          e: null
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'Without HBase',
          e: {
            'mapreduce.map.java.opts': '-Xmx1024m',
            'mapreduce.map.memory.mb': 1280,
            'mapreduce.reduce.java.opts': '-Xmx2048m',
            'mapreduce.reduce.memory.mb': 2560,
            'yarn.app.mapreduce.am.command-opts': '-Xmx2048m',
            'yarn.app.mapreduce.am.resource.mb': 2560,
            'yarn.nodemanager.resource.memory-mb': 20480,
            'yarn.scheduler.maximum-allocation-mb': 20480,
            'yarn.scheduler.minimum-allocation-mb': 2560,
            'mapreduce.task.io.sort.mb': 512
          }
        },
        {
          localDB: {
            "hosts": {
              "host1": {"name": "host1","cpu": 8,"memory": "25165824.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]},
              "host2": {"name": "host2","cpu": 4,"memory": "12582912.00","disk_info": [{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'},{mountpoint:'/'}]}
            },
            "masterComponentHosts": [
              {"component": "HBASE_MASTER","hostName": "host1","serviceId": "HDFS"}
            ],
            "slaveComponentHosts": [
              {
                "componentName": "NODEMANAGER",
                "hosts": [{"hostName": "host2"}]
              }
            ]
          },
          m: 'With HBase',
          e: {
            'mapreduce.map.java.opts': '-Xmx410m',
            'mapreduce.map.memory.mb': 512,
            'mapreduce.reduce.java.opts': '-Xmx819m',
            'mapreduce.reduce.memory.mb': 1024,
            'yarn.app.mapreduce.am.command-opts': '-Xmx819m',
            'yarn.app.mapreduce.am.resource.mb': 1024,
            'yarn.nodemanager.resource.memory-mb': 8192,
            'yarn.scheduler.maximum-allocation-mb': 8192,
            'yarn.scheduler.minimum-allocation-mb': 1024,
            'mapreduce.task.io.sort.mb': 205
          }
        }
      ]);
      tests.forEach(function(test) {
        it(test.m, function() {
          yarnDefaultProvider.set('clusterData', null);
          var configs = yarnDefaultProvider.getDefaults(test.localDB);

          for(var config in configs) {
            if (configs.hasOwnProperty(config)) {
              if (test.e) {
                expect(configs[config]).to.equal(test.e[config]);
              }
              else {
                expect(configs[config] == 0 || configs[config] == null).to.equal(true);
              }
            }
          }
        });
      });
    });

  });
  
});
window.require.register("test/utils/configs/validators/service_configs_validator_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  require('utils/configs/validators/service_configs_validator');

  describe('App.ServiceConfigsValidator', function() {

    describe('#validateConfig', function() {
      it('No config validator', function() {
        var v = App.ServiceConfigsValidator.create({});
        expect(v.validateConfig(Em.Object.create({name:'name'}))).to.equal(null);
      });
    });

    describe('#validatorLessThenDefaultValue', function() {
      var tests = Em.A([
        {
          recommendedDefaults: {
            'property1': 100500
          },
          config: Em.Object.create({
            value: 100000,
            name: 'property1'
          }),
          m: 'Numeric value',
          e: 'string'
        },
        {
          recommendedDefaults: {
            'property1': 'xx100500x'
          },
          config: Em.Object.create({
            value: 'xx100000x',
            name: 'property1'
          }),
          m: 'String value',
          e: 'string'
        },
        {
          recommendedDefaults: {
            'property1': null
          },
          config: Em.Object.create({
            value: 100000,
            name: 'property1'
          }),
          m: 'No default value for property',
          e: null
        }
      ]);
      tests.forEach(function(test) {
        it(test.m, function() {
          var v = App.ServiceConfigsValidator.create({});
          v.set('recommendedDefaults', test.recommendedDefaults);
          var r = v.validatorLessThenDefaultValue(test.config);
          if (test.e) {
            expect(r).to.be.a(test.e);
          }
          else {
            expect(r).to.equal(null)
          }
        });
      });
    });

    describe('#_checkXmxValueFormat', function() {
      var tests = Em.A([
        {value: '',e: false},
        {value: '-',e: false},
        {value: '100',e: false},
        {value: '-Xmx',e: false},
        {value: '-XMX1',e: false},
        {value: '-Xmxb',e: false},
        {value: '-Xmxk',e: false},
        {value: '-Xmxm',e: false},
        {value: '-Xmxg',e: false},
        {value: '-Xmxp',e: false},
        {value: '-Xmxt',e: false},
        {value: '-XmxB',e: false},
        {value: '-XmxK',e: false},
        {value: '-XmxM',e: false},
        {value: '-XmxG',e: false},
        {value: '-XmxP',e: false},
        {value: '-XmxT',e: false},
        {value: '-Xmx1',e: true},
        {value: '-Xmx1b',e: true},
        {value: '-Xmx1k',e: true},
        {value: '-Xmx1m',e: true},
        {value: '-Xmx1g',e: true},
        {value: '-Xmx1t',e: true},
        {value: '-Xmx1p',e: true},
        {value: '-Xmx1B',e: true},
        {value: '-Xmx1K',e: true},
        {value: '-Xmx1M',e: true},
        {value: '-Xmx1G',e: true},
        {value: '-Xmx1T',e: true},
        {value: '-Xmx1P',e: true},
        {value: '-Xmx100',e: true},
        {value: '-Xmx100b',e: true},
        {value: '-Xmx100k',e: true},
        {value: '-Xmx100m',e: true},
        {value: '-Xmx100g',e: true},
        {value: '-Xmx100t',e: true},
        {value: '-Xmx100p',e: true},
        {value: '-Xmx100B',e: true},
        {value: '-Xmx100K',e: true},
        {value: '-Xmx100M',e: true},
        {value: '-Xmx100G',e: true},
        {value: '-Xmx100T',e: true},
        {value: '-Xmx100P',e: true},
        {value: '-Xmx100Psome',e: false},
        {value: '-Xmx100P-Xmx',e: false},
        {value: '-Xmx100P -Xmx',e: false},
        {value: '-Xmx100P -XMX',e: false},
        {value: '-server -Xmx1024m -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: true},
        {value: '-server -Xmx1024 -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: true},
        {value: '-server -Xmx1024', e: true},
        {value: '-Xmx1024 -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: true},
        {value: '-server -Xmx1024m-Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-server -Xmx1024-Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-server-Xmx1024m -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-server-Xmx1024 -Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-server-Xmx1024m-Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-server-Xmx1024-Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-Xmx1024-Djava.net.preferIPv4Stack=true -XX:+UseNUMA -XX:+UseParallelGC', e: false},
        {value: '-server-Xmx1024', e: false},
        {value: '-server    -Xmx1024m   -Da=b',e: true},
        {value: '-server -Xmx1024m -Da=b',e: true},
        {value: '-server -XMx1024m -Da=b',e: false},
        {value: '-server -Xmx1024M -Da=b',e: true},
        {value: '-server -Xmx1 -Da=b',e: true},
        {value: '-server -Xmx1100MBPS -Da=b',e: false},
        {value: '-server -Xmx1100M -Xmx200 -Da=b',e: false},
        {value: '-server --Xmx1100M -Da=b',e: false},
        {value: '-Xmx1024m -server -Da=b',e: true},
        {value: ' -server -Da=b -Xmx1024m',e: true}
      ]);
      tests.forEach(function(test) {
        it(test.value, function() {
          var v = App.ServiceConfigsValidator.create({});
          expect(v._checkXmxValueFormat(test.value)).to.equal(test.e);
        });
      });
    });

    describe('#_getXmxSize', function() {
      var tests = Em.A([
        {value: '-Xmx1', e: '1'},
        {value: '-Xmx1b', e: '1b'},
        {value: '-Xmx1k', e: '1k'},
        {value: '-Xmx1m', e: '1m'},
        {value: '-Xmx1g', e: '1g'},
        {value: '-Xmx1t', e: '1t'},
        {value: '-Xmx1p', e: '1p'},
        {value: '-Xmx1B', e: '1b'},
        {value: '-Xmx1K', e: '1k'},
        {value: '-Xmx1M', e: '1m'},
        {value: '-Xmx1G', e: '1g'},
        {value: '-Xmx1T', e: '1t'},
        {value: '-Xmx1P', e: '1p'},
        {value: '-Xmx100b', e: '100b'},
        {value: '-Xmx100k', e: '100k'},
        {value: '-Xmx100m', e: '100m'},
        {value: '-Xmx100g', e: '100g'},
        {value: '-Xmx100t', e: '100t'},
        {value: '-Xmx100p', e: '100p'},
        {value: '-Xmx100B', e: '100b'},
        {value: '-Xmx100K', e: '100k'},
        {value: '-Xmx100M', e: '100m'},
        {value: '-Xmx100G', e: '100g'},
        {value: '-Xmx100T', e: '100t'},
        {value: '-Xmx100P', e: '100p'}
      ]);
      tests.forEach(function(test) {
        it(test.value, function() {
          var v = App.ServiceConfigsValidator.create({});
          expect(v._getXmxSize(test.value)).to.equal(test.e);
        });
      });
    });

    describe('#_formatXmxSizeToBytes', function() {
      var tests = Em.A([
        {value: '1', e: 1},
        {value: '1 ', e: 1},
        {value: '100', e: 100},
        {value: '100 ', e: 100},
        {value: '100b', e: 100},
        {value: '100B', e: 100},
        {value: '100k', e: 100 * 1024},
        {value: '100K', e: 100 * 1024},
        {value: '100m', e: 100 * 1024 * 1024},
        {value: '100M', e: 100 * 1024 * 1024},
        {value: '100g', e: 100 * 1024 * 1024 * 1024},
        {value: '100G', e: 100 * 1024 * 1024 * 1024},
        {value: '100t', e: 100 * 1024 * 1024 * 1024 * 1024},
        {value: '100T', e: 100 * 1024 * 1024 * 1024 * 1024},
        {value: '100p', e: 100 * 1024 * 1024 * 1024 * 1024 * 1024},
        {value: '100P', e: 100 * 1024 * 1024 * 1024 * 1024 * 1024}
      ]);
      tests.forEach(function(test) {
        it(test.value, function() {
          var v = App.ServiceConfigsValidator.create({});
          expect(v._formatXmxSizeToBytes(test.value)).to.equal(test.e);
        });
      });
    });

    describe('#validateXmxValue', function() {
      var tests = Em.A([
        {
          recommendedDefaults: {
            'property1': '-Xmx1024m'
          },
          config: Em.Object.create({
            value: '-Xmx2g',
            name: 'property1'
          }),
          e: null
        },
        {
          recommendedDefaults: {
            'property1': '-Xmx12'
          },
          config: Em.Object.create({
            value: '-Xmx24',
            name: 'property1'
          }),
          e: null
        },
        {
          recommendedDefaults: {
            'property1': '-Xmx333k'
          },
          config: Em.Object.create({
            value: '-Xmx134k',
            name: 'property1'
          }),
          e: 'string'
        },
        {
          recommendedDefaults: {
            'property1': '-Xmx333k'
          },
          config: Em.Object.create({
            value: '-Xmx534',
            name: 'property1'
          }),
          e: 'string'
        },
        {
          recommendedDefaults: {},
          config: Em.Object.create({
            defaultValue: '-Xmx123',
            value: '-Xmx123',
            name: 'name'
          }),
          e: null
        },
        {
          recommendedDefaults: {},
          config: Em.Object.create({
            defaultValue: '-Xmx124',
            value: '-Xmx123',
            name: 'name'
          }),
          e: 'string'
        }
      ]);
      tests.forEach(function(test) {
        it(test.config.get('value'), function() {
          var v = App.ServiceConfigsValidator.create({});
          v.set('recommendedDefaults', test.recommendedDefaults);
          var r = v.validateXmxValue(test.config);
          if (test.e) {
            expect(r).to.be.a(test.e);
          }
          else {
            expect(r).to.equal(null)
          }
        });
      });

      it('Error should be thrown', function() {
        var v = App.ServiceConfigsValidator.create({});
        v.set('recommendedDefaults', {});
        expect(function() {v.validateXmxValue(Em.Object.create({value:''}));}).to.throw(Error);
      });

    });

  });
  
});
window.require.register("test/utils/date_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  var validator = require('utils/validator');
  var date = require('utils/date');

  describe('date', function () {

    var correct_tests = Em.A([
      {t: 1349752195000, e: 'Tue, Oct 09, 2012 06:09', e2: 'Tue Oct 09 2012'},
      {t: 1367752195000, e: 'Sun, May 05, 2013 14:09', e2: 'Sun May 05 2013'},
      {t: 1369952195000, e: 'Fri, May 31, 2013 01:16', e2: 'Fri May 31 2013'}
    ]);

    var incorrect_tests = Em.A([
      {t: null},
      {t: ''},
      {t: false},
      {t: []},
      {t: {}},
      {t: undefined},
      {t: function(){}}
    ]);

    describe('#dateFormat', function() {
      it('Correct timestamps', function(){
        correct_tests.forEach(function(test) {
          expect(date.dateFormat(test.t)).to.equal(test.e);
        });
      });
      it('Incorrect timestamps', function() {
        incorrect_tests.forEach(function(test) {
          expect(date.dateFormat(test.t)).to.equal(test.t);
        });
      });
    });

    describe('#dateFormatShort', function() {
      it('Correct timestamps', function(){
        correct_tests.forEach(function(test) {
          expect(date.dateFormatShort(test.t)).to.equal(test.e2);
        });
      });
      it('Today timestamp', function() {
        var now = new Date();
        var then = new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0);
        expect(date.dateFormatShort(then.getTime() + 10*3600*1000)).to.equal('Today 10:00:00');
      });
      it('Incorrect timestamps', function() {
        incorrect_tests.forEach(function(test) {
          expect(date.dateFormatShort(test.t)).to.equal(test.t);
        });
      });
    });

    describe('#timingFormat', function() {
      var tests = Em.A([
        {i: '30', e:'30 ms'},
        {i: '300', e:'300 ms'},
        {i: '999', e:'999 ms'},
        {i: '1000', e:'1.00 secs'},
        {i: '3000', e:'3.00 secs'},
        {i: '35000', e:'35.00 secs'},
        {i: '350000', e:'350.00 secs'},
        {i: '999999', e:'1000.00 secs'},
        {i: '1000000', e:'16.67 mins'},
        {i: '3500000', e:'58.33 mins'},
        {i: '35000000', e:'9.72 hours'},
        {i: '350000000', e:'4.05 days'},
        {i: '3500000000', e:'40.51 days'},
        {i: '35000000000', e:'405.09 days'}
      ]);

      it('Correct data', function(){
        tests.forEach(function(test) {
          expect(date.timingFormat(test.i)).to.equal(test.e);
        });
      });

      it('Incorrect data', function(){
        incorrect_tests.forEach(function(test) {
          expect(date.timingFormat(test.t)).to.equal(null);
        });
      });

    });

    describe('#duration', function() {
      var tests = Em.A([
        {startTime: 1, endTime: 2, e: 1},
        {startTime: 0, endTime: 2000, e: 0}
      ]);
      tests.forEach(function(test) {
        it(test.startTime + ' ' + test.endTime, function() {
          expect(date.duration(test.startTime, test.endTime)).to.equal(test.e);
        });
      });
    });

  });
});
window.require.register("test/utils/form_field_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/form');


  /*
   * formField.isValid property doesn't update correctly, so I have to work with errorMessage property
   */
  describe('App.FormField', function () {

    describe('#validate()', function () {
      /*NUMBER TYPE END*/
      /*REQUIRE*/
      it('Required field shouldn\'t be empty', function () {
        var formField = App.FormField.create();
        formField.set('displayType', 'string');
        formField.set('value', '');
        formField.set('isRequired', true);
        formField.validate();
        expect(formField.get('errorMessage') === '').to.equal(false);
      });
      /*REQUIRE END*/

    });
  });
});
window.require.register("test/utils/host_progress_popup_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var Ember = require('ember');
  var App = require('app');

  require('controllers/global/background_operations_controller');
  require('views/common/modal_popup');
  require('utils/helper');
  require('utils/host_progress_popup');

  describe('App.HostPopup', function () {

    var services = [
      {
        displayName: "Start service WebHCat",
        hosts: [
          {
            logTasks: [
              {
                Tasks: {
                  command: "START",
                  host_name: "ip-10-12-123-90.ec2.internal",
                  role: "WEBHCAT_SERVER",
                  status: "QUEUED"
                },
                href: "http://ec2-54-224-233-43.compute-1.amazonaws.com:8080/api/v1/clusters/mycluster/requests/23/tasks/94"
              }
            ],
            name: "ip-10-12-123-90.ec2.internal",
            publicName: "ip-10-12-123-90.ec2.internal",
            serviceName: "Start service WebHCat"
          }
        ],
        isRunning: false
      },
      {
        displayName: "Start service Hive/HCat",
        hosts: [
          {
            logTasks: [
              {
                Tasks: {
                  command: "INSTALL",
                  host_name: "ip-10-12-123-90.ec2.internal",
                  status: "COMPLETED"
                },
                href: "http://ec2-54-224-233-43.compute-1.amazonaws.com:8080/api/v1/clusters/mycluster/requests/15/tasks/76"
              }
            ],
            name: "ip-10-12-123-90.ec2.internal",
            publicName: "ip-10-12-123-90.ec2.internal",
            serviceName: "Start service Hive/HCat"
          },
          {
            logTasks: [
              {
                Tasks: {
                  command: "START",
                  host_name: "ip-10-33-7-23.ec2.internal",
                  status: "COMPLETED"
                },
                href: "http://ec2-54-224-233-43.compute-1.amazonaws.com:8080/api/v1/clusters/mycluster/requests/15/tasks/78"
              },
              {
                Tasks: {
                  command: "START",
                  host_name: "ip-10-33-7-23.ec2.internal",
                  status: "COMPLETED"
                },
                href: "http://ec2-54-224-233-43.compute-1.amazonaws.com:8080/api/v1/clusters/mycluster/requests/15/tasks/79"
              }
            ],
            name: "ip-10-33-7-23.ec2.internal",
            publicName: "ip-10-33-7-23.ec2.internal",
            serviceName: "Start service Hive/HCat"
          }
        ],
        isRunning: false
      }
    ];

    var bgController = App.BackgroundOperationsController.create();
    bgController.set('services', services);

    describe('#initPopup', function() {
      App.HostPopup.initPopup("", bgController, true);
      it('services loaded', function() {
        expect(App.HostPopup.get('inputData').length).to.equal(services.length);
      });
    });

    var test_tasks = [
      {
        t: [
          {
            Tasks: {
              status: 'COMPLETED',
              id: 2
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 3
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 1
            }
          }
        ],
        m: 'All COMPLETED',
        r: 'SUCCESS',
        p: 100,
        ids: [1,2,3]
      },
      {
        t: [
          {
            Tasks: {
              status: 'FAILED',
              id: 2
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 1
            }
          }
          ,
          {
            Tasks: {
              status: 'COMPLETED',
              id: 3
            }
          }
        ],
        m: 'One FAILED',
        r: 'FAILED',
        p: 100,
        ids: [1,2,3]
      },
      {
        t: [
          {
            Tasks: {
              status: 'ABORTED',
              id: 1
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 2
            }
          }
        ],
        m: 'One ABORTED',
        r: 'CANCELLED',
        p: 100,
        ids: [1,2]
      },
      {
        t: [
          {
            Tasks: {
              status: 'TIMEDOUT',
              id: 3
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 1
            }
          }
        ],
        m: 'One TIMEDOUT',
        r: 'TIMEDOUT',
        p: 100,
        ids: [1,3]
      },
      {
        t: [
          {
            Tasks: {
              status: 'IN_PROGRESS',
              id: 1
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 2
            }
          }
        ],
        m: 'One IN_PROGRESS',
        r: 'IN_PROGRESS',
        p: 68,
        ids: [1,2]
      },
      {
        t: [
          {
            Tasks: {
              status: 'QUEUED',
              id: 2
            }
          },
          {
            Tasks: {
              status: 'COMPLETED',
              id: 3
            }
          }
        ],
        m: 'Something else',
        r: 'PENDING',
        p: 55,
        ids: [2,3]
      }
    ];

    describe('#setSelectCount', function () {
      var itemsForStatusTest = [
        {
          title: 'Empty',
          data: [],
          result: [0, 0, 0, 0, 0, 0, 0]
        },
        {
          title: 'All Pending',
          data: [
            {status: 'pending'},
            {status: 'queued'}
          ],
          result: [2, 2, 0, 0, 0, 0, 0]
        },
        {
          title: 'All Completed',
          data: [
            {status: 'success'},
            {status: 'completed'}
          ],
          result: [2, 0, 0, 0, 2, 0, 0]
        },
        {
          title: 'All Failed',
          data: [
            {status: 'failed'},
            {status: 'failed'}
          ],
          result: [2, 0, 0, 2, 0, 0, 0]
        },
        {
          title: 'All InProgress',
          data: [
            {status: 'in_progress'},
            {status: 'in_progress'}
          ],
          result: [2, 0, 2, 0, 0, 0, 0]
        },
        {
          title: 'All Aborted',
          data: [
            {status: 'aborted'},
            {status: 'aborted'}
          ],
          result: [2, 0, 0, 0, 0, 2, 0]
        },
        {
          title: 'All Timedout',
          data: [
            {status: 'timedout'},
            {status: 'timedout'}
          ],
          result: [2, 0, 0, 0, 0, 0, 2]
        },
        {
          title: 'Every Category',
          data: [
            {status: 'pending'},
            {status: 'queued'},
            {status: 'success'},
            {status: 'completed'},
            {status: 'failed'},
            {status: 'in_progress'},
            {status: 'aborted'},
            {status: 'timedout'}
          ],
          result: [8, 2, 1, 1, 2, 1, 1]
        }
      ];
      var categories = [
        Ember.Object.create({value: 'all'}),
        Ember.Object.create({value: 'pending'}),
        Ember.Object.create({value: 'in_progress'}),
        Ember.Object.create({value: 'failed'}),
        Ember.Object.create({value: 'completed'}),
        Ember.Object.create({value: 'aborted'}),
        Ember.Object.create({value: 'timedout'})
      ];
      itemsForStatusTest.forEach(function(statusTest) {
        it(statusTest.title, function() {
          App.HostPopup.setSelectCount(statusTest.data, categories);
          expect(categories.mapProperty('count')).to.deep.equal(statusTest.result);
        });
      });
    });

    describe('#getStatus', function() {
      test_tasks.forEach(function(test_task) {
        it(test_task.m, function() {
          expect(App.HostPopup.getStatus(test_task.t)[0]).to.equal(test_task.r);
        });
      });
    });

    describe('#getProgress', function() {
      test_tasks.forEach(function(test_task) {
        it(test_task.m, function() {
          expect(App.HostPopup.getProgress(test_task.t)).to.equal(test_task.p);
        });
      });
    });

  });
  
});
window.require.register("test/utils/lazy_loading_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var lazyLoading = require('utils/lazy_loading');

  describe('lazy_loading', function () {

    describe('#run', function () {
      var context = Em.Object.create({isLoaded: false});
      var options = {
        destination: [],
        source: [{'test':'test'}],
        context: context
      };
      it('load one item', function () {
        lazyLoading.run(options);
        expect(options.destination[0]).to.eql(options.source[0]);
        expect(context.get('isLoaded')).to.equal(true);
      });

      var testsInfo = [
        {
          title: 'load 11 item with initSize - 11',
          result: true,
          initSize: 11,
          destinationLength: 11,
          destination: [],
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          context: Em.Object.create()
        },
        {
          title: 'load 11 item with initSize - 12',
          result: true,
          initSize: 12,
          destinationLength: 11,
          destination: [],
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          context: Em.Object.create()
        },
        {//items will be completely loaded on next iteration of pushing chunk
          title: 'load 11 item with initSize - 10',
          result: false,
          initSize: 10,
          destinationLength: 10,
          destination: [],
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          context: Em.Object.create({isLoaded: false})
        }
      ];
      testsInfo.forEach(function(test){
        it(test.title, function () {
          lazyLoading.run(test);
          expect(test.destinationLength).to.equal(test.destination.length);
          expect(test.context.get('isLoaded')).to.equal(test.result);
        });
      });
    });

    describe('#divideIntoChunks', function () {
      var testsInfo = [
        {
          title: 'load 11 item with chunkSize - 3',
          chunkSize: 3,
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          chunks: [[{i:1}, {i:2}, {i:3}], [{i:4}, {i:5}, {i:6}], [{i:7}, {i:8}, {i:9}], [{i:10},{i:11}]]
        },
        {
          title: 'load 11 item with chunkSize - 0',
          chunkSize: 0,
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          chunks: [[{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}]]
        },
        {
          title: 'load 11 item with chunkSize - 1',
          chunkSize: 1,
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          chunks: [[{i:1}], [{i:2}], [{i:3}], [{i:4}], [{i:5}], [{i:6}], [{i:7}], [{i:8}], [{i:9}], [{i:10}], [{i:11}]]
        },
        {
          title: 'load 11 item with chunkSize - 11',
          chunkSize: 0,
          source: [{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}],
          chunks: [[{i:1}, {i:2}, {i:3}, {i:4}, {i:5}, {i:6}, {i:7}, {i:8}, {i:9}, {i:10},{i:11}]]
        }
      ];
      testsInfo.forEach(function(test){
        it(test.title, function () {
          var chunks = lazyLoading.divideIntoChunks(test.source, test.chunkSize);
          expect(chunks).to.eql(test.chunks);
        });
      });
    });


  });
  
});
window.require.register("test/utils/misc_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var misc = require('utils/misc');

  describe('misc', function () {

    describe('#formatBandwidth', function () {
      var tests = Em.A([
        {m:'undefined to undefined',i:undefined,e:undefined},
        {m:'0 to <1KB',i:'0',e:'<1KB'},
        {m:'1000 to <1KB',i:'1000',e:'<1KB'},
        {m:'1024 to 1.0KB',i:'1024',e:'1.0KB'},
        {m:'2048 to 2.0KB',i:'2048',e:'2.0KB'},
        {m:'1048576 to 1.0MB',i:'1048576',e:'1.0MB'},
        {m:'1782579 to 1.7MB',i:'1782579',e:'1.7MB'},
        {m:'1546188226 to 1.44GB',i:'1546188226',e:'1.44GB'}
      ]);
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(misc.formatBandwidth(test.i)).to.equal(test.e);
        });
      });
      it('NaN to NaN' + ' ', function () {
        expect(isNaN(misc.formatBandwidth(NaN))).to.equal(true);
      });
    });

    describe('#ipToInt', function () {
      var tests = Em.A([
        {m:'0.0.0.0 to 0',i:'0.0.0.0',e:0},
        {m:'255.255.255.255 to 4294967295',i:'255.255.255.255',e:4294967295},
        {m:'"" to false',i:'',e:false},
        {m:'255.255.255.256 to false',i:'255.255.255.256',e:false},
        {m:'255.255.255 to false',i:'255.255.255',e:false}
      ]);
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(misc.ipToInt(test.i)).to.equal(test.e);
        });
      });
    });

    describe('#sortByOrder', function() {
      var tests = Em.A([
        {
          sortOrder: ['b', 'c', 'a'],
          array: [{id:'a'}, {id:'b'}, Em.Object.create({id:'c'})],
          e: [{id:'b'}, Em.Object.create({id:'c'}), {id:'a'}],
          m: 'Array with Ember and native objects'
        },
        {
          sortOrder: ['b', 'c', 'a'],
          array: [{id:'a'}, {id:'b'}, {id:'c'}],
          e: [{id:'b'}, {id:'c'}, {id:'a'}],
          m: 'Array with native objects'
        },
        {
          sortOrder: ['b', 'c', 'a'],
          array: [Em.Object.create({id:'a'}), Em.Object.create({id:'b'}), Em.Object.create({id:'c'})],
          e: [Em.Object.create({id:'b'}), Em.Object.create({id:'c'}), Em.Object.create({id:'a'})],
          m: 'Array with Ember objects'
        }
      ]);
      tests.forEach(function(test) {
        it(test.m, function() {
          expect(misc.sortByOrder(test.sortOrder, test.array)).to.eql(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/utils/number_utils_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var numberUtils = require('utils/number_utils');

  describe('', function() {

    describe('#bytesToSize', function() {

      describe('check bytes', function() {
        var tests = Em.A([
          {
            bytes: null,
            precision: null,
            parseType: null,
            multiplyBy: null,
            e: 'n/a',
            m: '"n/a" if bytes is null'
          },
          {
            bytes: undefined,
            precision: null,
            parseType: null,
            multiplyBy: null,
            e: 'n/a',
            m: '"n/a" if bytes is undefined'
          }
        ]);

        tests.forEach(function(test) {
          it(test.m, function() {
            expect(numberUtils.bytesToSize(test.bytes, test.precision, test.parseType, test.multiplyBy)).to.equal(test.e);
          });
        });
      });

      describe('check sizes', function() {
        var tests = Em.A([
          {
            bytes: 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: 'Bytes',
            m: 'Bytes'
          },
          {
            bytes: 1024 + 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: 'KB',
            m: 'KB'
          },
          {
            bytes: 1024 * 1024 + 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: 'MB',
            m: 'MB'
          },
          {
            bytes: 1024 * 1024 * 1024 + 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: 'GB',
            m: 'GB'
          },
          {
            bytes: 1024 * 1024 * 1024 * 1024 + 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: 'TB',
            m: 'TB'
          },
          {
            bytes: 1024 * 1024 * 1024 * 1024 * 1024 + 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: 'PB',
            m: 'PB'
          }
        ]);

        tests.forEach(function(test) {
          it(test.m, function() {
            expect(numberUtils.bytesToSize(test.bytes, test.precision, test.parseType, test.multiplyBy).endsWith(test.e)).to.equal(true);
          });
        });
      });

      describe('check calculated result', function() {
        var tests = Em.A([
          {
            bytes: 42,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: '42',
            m: 'Bytes'
          },
          {
            bytes: 1024 * 12,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: '12',
            m: 'KB'
          },
          {
            bytes: 1024 * 1024 * 23,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: '23',
            m: 'MB'
          },
          {
            bytes: 1024 * 1024 * 1024 * 34,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: '34',
            m: 'GB'
          },
          {
            bytes: 1024 * 1024 * 1024 * 1024 * 45,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: '45',
            m: 'TB'
          },
          {
            bytes: 1024 * 1024 * 1024 * 1024 * 1024 * 56,
            precision: null,
            parseType: 'parseInt',
            multiplyBy: 1,
            e: '56',
            m: 'PB'
          }
        ]);

        tests.forEach(function(test) {
          it(test.m, function() {
            expect(numberUtils.bytesToSize(test.bytes, test.precision, test.parseType, test.multiplyBy).startsWith(test.e)).to.equal(true);
          });
        });
      });

    });

  });
});
window.require.register("test/utils/string_utils_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var string_utils = require('utils/string_utils');
  require('utils/helper');

  describe('string_utils', function () {

    describe('#underScoreToCamelCase', function () {
      var tests = [
        {m:'a_b_c to aBC',i:'a_b_c',e:'aBC'},
        {m:'a_bc to aBc',i:'a_bc',e:'aBc'},
        {m:'ab_c to abC',i:'ab_c',e:'abC'},
        {m:'_b_c to BC',i:'_b_c',e:'BC'}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(string_utils.underScoreToCamelCase(test.i)).to.equal(test.e);
        });
      });
    });

    describe('#pad', function () {
      var tests = [
        {m: '"name" to "    name"', i: 'name', l: 8, a: 1, f: ' ', e: '    name'},
        {m: '"name" to "name    "', i: 'name', l: 8, a: 2, f: ' ', e: 'name    '},
        {m: '"name" to "  name  "', i: 'name', l: 8, a: 3, f: ' ', e: '  name  '},
        {m: '"name" to "name    "', i: 'name', l: 8, a: 0, f: ' ', e: 'name    '},
        {m: '"name" to "name    "', i: 'name', l: 8, a:-1, f: ' ', e: 'name    '},
        {m: '"name" to "name"', i: 'name', l: 4, a: 1, f: ' ', e: 'name'},
        {m: '"name" to "||||||||name"', i: 'name', l: 8, a:1, f: '||', e: '||||||||name'},
        {m: '"name" to "||||name||||"', i: 'name', l: 8, a:3, f: '||', e: '||||name||||'},
        {m: '"name" to "name||||||||"', i: 'name', l: 8, a:2, f: '||', e: 'name||||||||'}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(string_utils.pad(test.i, test.l, test.f, test.a)).to.equal(test.e);
        });
      });
    });

    describe('#compareVersions', function () {
      var tests = [
        {m: '1.2 equal to 1.2', v1:'1.2', v2:'1.2', e: 0},
        {m: '1.2 lower than 1.3', v1:'1.2', v2:'1.3', e: -1},
        {m: '1.3 higher than 1.2', v1:'1.3', v2:'1.2', e: 1},
        {m: '1.2.1 higher than 1.2', v1:'1.2.1', v2:'1.2', e: 1},
        {m: '11.2 higher than 2.2', v1:'11.2', v2:'2.2', e: 1},
        {m: '0.9 higher than 0.8', v1:'0.9', v2:'0.8', e: 1}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(string_utils.compareVersions(test.v1, test.v2)).to.equal(test.e);
        });
      });
    });

    describe('#isSingleLine', function () {
      var tests = [
        {m: 'is single line text', t: 'a b', e: true},
        {m: 'is single line text', t: 'a b\n', e: true},
        {m: 'is single line text', t: '\na b', e: true},
        {m: 'is not single line text', t: 'a\nb', e: false}
      ];
      tests.forEach(function(test) {
        it(test.t + ' ' + test.m + ' ', function () {
          expect(string_utils.isSingleLine(test.t)).to.equal(test.e);
        });
      });
    });

    describe('#arrayToCSV', function() {
      var test = [{a: 1, b:2, c:3}, {a: 1, b:2, c:3}, {a: 1, b:2, c:3}];
      it('array of object to csv-string', function () {
        expect(string_utils.arrayToCSV(test)).to.equal("1,2,3\n1,2,3\n1,2,3\n");
      });
    });

    describe('#getFileFromPath', function() {
      var tests = [
        {t: undefined, e: ''},
        {t: {}, e: ''},
        {t: [], e: ''},
        {t: '', e: ''},
        {t: function(){}, e: ''},
        {t: '/path/to/file.ext', e: 'file.ext'},
        {t: 'file.ext', e: 'file.ext'},
        {t: 'file', e: 'file'},
        {t: '/path/to/file', e: 'file'}
      ];
      tests.forEach(function(test) {
        it('Check ' + typeof test.t, function () {
          expect(string_utils.getFileFromPath(test.t)).to.equal(test.e);
        });
      });
    });

    describe('#getPath', function() {
        var tests = [
          {t: undefined, e: ''},
          {t: {}, e: ''},
          {t: [], e: ''},
          {t: '', e: ''},
          {t: function(){}, e: ''},
          {t: '/path/to/filename', e: '/path/to'},
          {t: '/path/to/', e: '/path/to'},
          {t: '/filename', e: '/'},
          {t: 'filename', e: ''},
          {t: '/path/', e: '/path'},
          {t: 'filename/', e: ''}
        ];
        tests.forEach(function(test) {
            it('Check ' + typeof test.t, function () {
              expect(string_utils.getPath(test.t)).to.equal(test.e);
            });
        });
    });

    describe('#getCamelCase', function () {
      var tests = [
        {i:'a',e:'A'},
        {i:'aB',e:'Ab'},
        {i:'a b',e:'A B'},
        {i:'a.b',e:'A.B'},
        {i:'a,b',e:'A,B'},
        {i:'a;b',e:'A;B'},
        {i:'a. b',e:'A. B'},
        {i:'a   b',e:'A   B'},
        {i:'aaa. bbb',e:'Aaa. Bbb'},
        {i:'aAA. bBB',e:'Aaa. Bbb'},
        {i:'STARTING',e:'Starting'},
        {i:'starting',e:'Starting'},
        {i:'starting,ending',e:'Starting,Ending'}
      ];
      tests.forEach(function(test) {
        it(test.i + ' to ' + test.e + ' ', function () {
          expect(string_utils.getCamelCase(test.i)).to.equal(test.e);
        });
      });
    });

    describe('#findIn', function () {
      var tests = [
        {
          obj: {
            a: '1',
            b: '2'
          },
          key: 'a',
          index: 0,
          e: '1'
        }, {
          obj: {
            a: '1',
            b: '2'
          },
          key: 'a',
          index: 1,
          e: null
        }, {
          obj: {
            a: '1',
            b: '2',
            c: {
              a: '11',
              aa: '12'
            }
          },
          key: 'a',
          index: 1,
          e: '11'
        }, {
          obj: {
            a: '1',
            b: '2',
            c: {
              a: '11',
              aa: {
                a: '22'
              }
            }
          },
          key: 'a',
          index: 2,
          e: '22'
        }, {
          obj: {
            a: '1',
            b: '2',
            c: {
              a: '11',
              aa: {
                a: '22'
              }
            }
          },
          key: 'a',
          index: 0,
          e: '1'
        }, {
          obj: {
            a: '1',
            b: '2',
            c: {
              a: '11',
              aa: {
                a: '22'
              }
            }
          },
          key: 'g',
          index: 0,
          e: null
        }
      ];
      tests.forEach(function(test) {
        it(test.key + ' @ ' + test.index + ' = ' + test.e, function () {
          expect(test.key.findIn(test.obj, test.index)).to.equal(test.e);
        });
      });
    });
  });
  
});
window.require.register("test/utils/validator_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var validator = require('utils/validator');

  describe('validator', function () {

    describe('#isValidEmail(value)', function () {
      it('should return false if value is null', function () {
        expect(validator.isValidEmail(null)).to.equal(false);
      });
      it('should return false if value is ""', function () {
        expect(validator.isValidEmail('')).to.equal(false);
      });
      it('should return false if value is "a.com"', function () {
        expect(validator.isValidEmail('a.com')).to.equal(false);
      });
      it('should return false if value is "@a.com"', function () {
        expect(validator.isValidEmail('@a.com')).to.equal(false);
      });
      it('should return false if value is "a@.com"', function () {
        expect(validator.isValidEmail('a@.com')).to.equal(false);
      });
      it('should return true if value is "a@a.com"', function () {
        expect(validator.isValidEmail('a@a.com')).to.equal(true);
      });
      it('should return true if value is "user@a.b.com"', function () {
        expect(validator.isValidEmail('user@a.b.com')).to.equal(true);
      })
    });

    describe('#isValidInt(value)', function () {
      it('should return false if value is null', function () {
        expect(validator.isValidInt(null)).to.equal(false);
      });
      it('should return false if value is ""', function () {
        expect(validator.isValidInt('')).to.equal(false);
      });
      it('should return false if value is "abc"', function () {
        expect(validator.isValidInt('abc')).to.equal(false);
      });
      it('should return false if value is "0xff"', function () {
        expect(validator.isValidInt('0xff')).to.equal(false);
      });
      it('should return false if value is " 1""', function () {
        expect(validator.isValidInt(' 1')).to.equal(false);
      });
      it('should return false if value is "1 "', function () {
        expect(validator.isValidInt('1 ')).to.equal(false);
      });
      it('should return true if value is "10"', function () {
        expect(validator.isValidInt('10')).to.equal(true);
      });
      it('should return true if value is "-123"', function () {
        expect(validator.isValidInt('-123')).to.equal(true);
      });
      it('should return true if value is "0"', function () {
        expect(validator.isValidInt('0')).to.equal(true);
      });
      it('should return true if value is 10', function () {
        expect(validator.isValidInt(10)).to.equal(true);
      });
      it('should return true if value is -123', function () {
        expect(validator.isValidInt(10)).to.equal(true);
      });
      it('should return true if value is 0', function () {
        expect(validator.isValidInt(10)).to.equal(true);
      })
    });

    describe('#isValidFloat(value)', function () {
      it('should return false if value is null', function () {
        expect(validator.isValidFloat(null)).to.equal(false);
      });
      it('should return false if value is ""', function () {
        expect(validator.isValidFloat('')).to.equal(false);
      });
      it('should return false if value is "abc"', function () {
        expect(validator.isValidFloat('abc')).to.equal(false);
      });
      it('should return false if value is "0xff"', function () {
        expect(validator.isValidFloat('0xff')).to.equal(false);
      });
      it('should return false if value is " 1""', function () {
        expect(validator.isValidFloat(' 1')).to.equal(false);
      });
      it('should return false if value is "1 "', function () {
        expect(validator.isValidFloat('1 ')).to.equal(false);
      });
      it('should return true if value is "10"', function () {
        expect(validator.isValidFloat('10')).to.equal(true);
      });
      it('should return true if value is "-123"', function () {
        expect(validator.isValidFloat('-123')).to.equal(true);
      });
      it('should return true if value is "0"', function () {
        expect(validator.isValidFloat('0')).to.equal(true);
      });
      it('should return true if value is 10', function () {
        expect(validator.isValidFloat(10)).to.equal(true);
      });
      it('should return true if value is -123', function () {
        expect(validator.isValidFloat(10)).to.equal(true);
      });
      it('should return true if value is 0', function () {
        expect(validator.isValidFloat(10)).to.equal(true);
      });
      it('should return true if value is "0.0"', function () {
        expect(validator.isValidFloat("0.0")).to.equal(true);
      });
      it('should return true if value is "10.123"', function () {
        expect(validator.isValidFloat("10.123")).to.equal(true);
      });
      it('should return true if value is "-10.123"', function () {
        expect(validator.isValidFloat("-10.123")).to.equal(true);
      });
      it('should return true if value is 10.123', function () {
        expect(validator.isValidFloat(10.123)).to.equal(true);
      });
      it('should return true if value is -10.123', function () {
        expect(validator.isValidFloat(-10.123)).to.equal(true);
      })

    });
    /*describe('#isIpAddress(value)', function () {
      it('"127.0.0.1" - valid IP', function () {
        expect(validator.isIpAddress('127.0.0.1')).to.equal(true);
      })
      it('"227.3.67.196" - valid IP', function () {
        expect(validator.isIpAddress('227.3.67.196')).to.equal(true);
      })
      it('"327.0.0.0" - invalid IP', function () {
        expect(validator.isIpAddress('327.0.0.0')).to.equal(false);
      })
      it('"127.0.0." - invalid IP', function () {
        expect(validator.isIpAddress('127.0.0.')).to.equal(false);
      })
      it('"127.0." - invalid IP', function () {
        expect(validator.isIpAddress('127.0.')).to.equal(false);
      })
      it('"127" - invalid IP', function () {
        expect(validator.isIpAddress('127')).to.equal(false);
      })
      it('"127.333.0.1" - invalid IP', function () {
        expect(validator.isIpAddress('127.333.0.1')).to.equal(false);
      })
      it('"127.0.333.1" - invalid IP', function () {
        expect(validator.isIpAddress('127.0.333.1')).to.equal(false);
      })
      it('"127.0.1.333" - invalid IP', function () {
        expect(validator.isIpAddress('127.0.1.333')).to.equal(false);
      })
      it('"127.0.0.0:45555" - valid IP', function () {
        expect(validator.isIpAddress('127.0.0.0:45555')).to.equal(true);
      })
      it('"327.0.0.0:45555" - invalid IP', function () {
        expect(validator.isIpAddress('327.0.0.0:45555')).to.equal(false);
      })
      it('"0.0.0.0" - invalid IP', function () {
        expect(validator.isIpAddress('0.0.0.0')).to.equal(false);
      })
      it('"0.0.0.0:12" - invalid IP', function () {
        expect(validator.isIpAddress('0.0.0.0:12')).to.equal(false);
      })
      it('"1.0.0.0:0" - invalid IP', function () {
        expect(validator.isIpAddress('1.0.0.0:0')).to.equal(false);
      })
    })*/
    describe('#isDomainName(value)', function () {
      it('"google.com" - valid Domain Name', function () {
        expect(validator.isDomainName('google.com')).to.equal(true);
      });
      it('"google" - invalid Domain Name', function () {
        expect(validator.isDomainName('google')).to.equal(false);
      });
      it('"123.123" - invalid Domain Name', function () {
        expect(validator.isDomainName('123.123')).to.equal(false);
      });
      it('"4goog.le" - valid Domain Name', function () {
        expect(validator.isDomainName('4goog.le')).to.equal(true);
      });
      it('"55454" - invalid Domain Name', function () {
        expect(validator.isDomainName('55454')).to.equal(false);
      })
    });
    describe('#isValidUserName(value)', function() {
      var tests = [
        {m:'"" - invalid',i:'',e:false},
        {m:'"abc123" - valid',i:'abc123',e:true},
        {m:'"1abc123" - invalid',i:'1abc123',e:false},
        {m:'"abc123$" - invalid',i:'abc123$',e:false},
        {m:'"~1abc123" - invalid',i: '~1abc123',e:false},
        {m:'"abc12345679abc1234567890abc1234567890$" - invalid',i:'abc12345679abc1234567890abc1234567890$',e:false},
        {m:'"1abc123$$" - invalid',i:'1abc123$$',e:false},
        {m:'"a" - valid',i:'a',e:true},
        {m:'"!" - invalid',i:'!',e:false},
        {m:'"root$" - invalid',i:'root$',e:false},
        {m:'"rootU" - invalid',i:'rootU',e:false},
        {m:'"rUoot" - invalid',i:'rUoot',e:false}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(validator.isValidUserName(test.i)).to.equal(test.e);
        })
      });
    });
    describe('#isValidUNIXUser(value)', function() {
      var tests = [
        {m:'"" - invalid',i:'',e:false},
        {m:'"abc123" - valid',i:'abc123',e:true},
        {m:'"1abc123" - invalid',i:'1abc123',e:false},
        {m:'"abc123$" - invalid',i:'abc123$',e:false},
        {m:'"~1abc123" - invalid',i: '~1abc123',e:false},
        {m:'"abc12345679abc1234567890abc1234567890$" - invalid',i:'abc12345679abc1234567890abc1234567890$',e:false},
        {m:'"1abc123$$" - invalid',i:'1abc123$$',e:false},
        {m:'"a" - valid',i:'a',e:true},
        {m:'"!" - invalid',i:'!',e:false},
        {m:'"abc_" - valid',i:'abc_',e:true},
        {m:'"_abc" - valid',i:'_abc',e:true},
        {m:'"abc_abc" - valid',i:'_abc',e:true}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(validator.isValidUNIXUser(test.i)).to.equal(test.e);
        })
      });
    });
    describe('#isValidDir(value)', function() {
      var tests = [
        {m:'"dir" - invalid',i:'dir',e:false},
        {m:'"/dir" - valid',i:'/dir',e:true},
        {m:'"/dir1,dir2" - invalid',i:'/dir1,dir2',e:false},
        {m:'"/dir1,/dir2" - valid',i:'/dir1,/dir2',e:true},
        {m:'"/123" - valid',i:'/111',e:true},
        {m:'"/abc" - valid',i:'/abc',e:true},
        {m:'"/1a2b3c" - valid',i:'/1a2b3c',e:true}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(validator.isValidDir(test.i)).to.equal(test.e);
        })
      });
    });
    describe('#isAllowedDir(value)', function() {
      var tests = [
        {m:'"/home" - not allowed',i:'/home',e:false},
        {m:'"/homes" - not allowed',i:'/homes',e:false},
        {m:'"/home/" - not allowed',i:'/home/',e:false},
        {m:'"/homes/" - not allowed',i:'/homes/',e:false},
        {m:'"/dir" - allowed',i:'/dir',e:true},
        {m:'"/dir/home" - allowed',i:'/dir/home',e:true},
        {m:'"/dir/homes" - allowed',i:'/dir/homes',e:true},
        {m:'"/dir/home/" - allowed',i:'/dir/home/',e:true},
        {m:'"/dir/homes/" - allowed',i:'/dir/homes/',e:true}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(validator.isAllowedDir(test.i)).to.equal(test.e);
        })
      });
    });
    describe('#isValidConfigKey(value)', function() {
      var tests = [
        {m:'"123" - valid',i:'123',e:true},
        {m:'"abc" - valid',i:'abc',e:true},
        {m:'"abc123" - valid',i:'abc123',e:true},
        {m:'".abc." - valid',i:'.abc.',e:true},
        {m:'"_abc_" - valid',i:'_abc_',e:true},
        {m:'"-abc-" - valid',i:'-abc-',e:true},
        {m:'"abc 123" - invalid',i:'abc 123',e:false},
        {m:'"a"b" - invalid',i:'a"b',e:false},
        {m:'"a\'b" - invalid',i:'a\'b',e:false}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(validator.isValidConfigKey(test.i)).to.equal(test.e);
        })
      });
    })
  });
});
window.require.register("test/views/common/chart/linear_time_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/common/chart/linear_time');

  describe('App.ChartLinearTimeView', function () {

    var chartLinearTimeView = App.ChartLinearTimeView.create({});

    describe('#transformData ([[1, 2], [2, 3], [3, 4]], "abc")', function () {

      var data = [[1, 2], [2, 3], [3, 4]];
      var name = 'abc';
      var result = chartLinearTimeView.transformData(data, name);
      it('"name" should be "abc" ', function () {
        expect(result.name).to.equal('abc');
      });
      it('data size should be 3 ', function () {
        expect(result.data.length).to.equal(3);
      });
      it('data[0].x should be 2 ', function () {
        expect(result.data[0].x).to.equal(2);
      });
      it('data[0].y should be 1 ', function () {
        expect(result.data[0].y).to.equal(1);
      })
    }),
    describe('#yAxisFormatter', function() {
      var tests = [
        {m:'undefined to 0',i:undefined,e:0},
        {m:'NaN to 0',i:NaN,e:0},
        {m:'0 to 0',i:'0',e:'0'},
        {m:'1000 to 1K',i:'1000',e:'1K'},
        {m:'1000000 to 1M',i:'1000000',e:'1M'},
        {m:'1000000000 to 1B',i:'1000000000',e:'1B'},
        {m:'1000000000000 to 1T',i:'1000000000000',e:'1T'},
        {m:'1048576 to 1.049M',i:'1048576',e:'1.049M'},
        {m:'1073741824 to 1.074B',i:'1073741824',e:'1.074B'}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(chartLinearTimeView.yAxisFormatter(test.i)).to.equal(test.e);
        });
      });
    }),
    describe('#checkSeries', function() {
      var tests = [
        {m:'undefined - false',i:undefined,e:false},
        {m:'NaN - false',i:NaN,e:false},
        {m:'object without data property - false',i:[{}],e:false},
        {m:'object with empty data property - false',i:[{data:[]}],e:false},
        {m:'object with invalid data property - false',i:[{data:[1]}],e:false},
        {m:'object with valid data property - true',i:[{data:[{x:1,y:1},{x:2,y:2}]}],e:true}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(chartLinearTimeView.checkSeries(test.i)).to.equal(test.e);
        });
      });
    }),
    describe('#BytesFormatter', function() {
      var tests = [
        {m:'undefined to "0 B"',i:undefined,e:'0 B'},
        {m:'NaN to "0 B"',i:NaN,e:'0 B'},
        {m:'0 to "0 B"',i:0,e:'0 B'},
        {m:'124 to "124 B"',i:124,e:'124 B'},
        {m:'1024 to "1 KB"',i:1024,e:'1 KB'},
        {m:'1536 to "1 KB"',i:1536,e:'1.5 KB'},
        {m:'1048576 to "1 MB"',i:1048576,e:'1 MB'},
        {m:'1073741824 to "1 GB"',i:1073741824,e:'1 GB'},
        {m:'1610612736 to "1.5 GB"',i:1610612736,e:'1.5 GB'}
      ];

      tests.forEach(function(test) {
        it(test.m + ' ', function () {

          expect(App.ChartLinearTimeView.BytesFormatter(test.i)).to.equal(test.e);
        });
      });
    }),
    describe('#PercentageFormatter', function() {
      var tests = [
        {m:'undefined to "0 %"',i:undefined,e:'0 %'},
        {m:'NaN to "0 %"',i:NaN,e:'0 %'},
        {m:'0 to "0 %"',i:0,e:'0 %'},
        {m:'1 to "1%"',i:1,e:'1%'},
        {m:'1.12341234 to "1.123%"',i:1.12341234,e:'1.123%'},
        {m:'-11 to "-11%"',i:-11,e:'-11%'},
        {m:'-11.12341234 to "-11.123%"',i:-11.12341234,e:'-11.123%'}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(App.ChartLinearTimeView.PercentageFormatter(test.i)).to.equal(test.e);
        });
      });
    });
    describe('#TimeElapsedFormatter', function() {
      var tests = [
        {m:'undefined to "0 ms"',i:undefined,e:'0 ms'},
        {m:'NaN to "0 ms"',i:NaN,e:'0 ms'},
        {m:'0 to "0 ms"',i:0,e:'0 ms'},
        {m:'1000 to "1000 ms"',i:1000,e:'1000 ms'},
        {m:'120000 to "2 m"',i:120000,e:'2 m'},
        {m:'3600000 to "60 m"',i:3600000,e:'60 m'},
        {m:'5000000 to "1 hr"',i:5000000,e:'1 hr'},
        {m:'7200000 to "2 hr"',i:7200000,e:'2 hr'},
        {m:'90000000 to "1 d"',i:90000000,e:'1 d'}
      ];
      tests.forEach(function(test) {
        it(test.m + ' ', function () {
          expect(App.ChartLinearTimeView.TimeElapsedFormatter(test.i)).to.equal(test.e);
        });
      });
    })
  });
  
});
window.require.register("test/views/common/configs/services_config_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/common/chart/pie');
  require('views/common/configs/services_config');


  describe('App.ServiceConfigView', function () {
    var controller = App.WizardStep7Controller.create({
      selectedServiceObserver: function(){},
      switchConfigGroupConfigs: function(){}
    });
    var view = App.ServiceConfigView.create({
      controller: controller
    });
    var testCases = [
      {
        title: 'selectedConfigGroup is null',
        result: {
          'category1': false,
          'category2': true,
          'category3': false
        },
        selectedConfigGroup: null,
        selectedService: {
          serviceName: 'TEST',
          configCategories: [
            App.ServiceConfigCategory.create({ name: 'category1', canAddProperty: false}),
            App.ServiceConfigCategory.create({ name: 'category2', siteFileName: 'xml', canAddProperty: true}),
            App.ServiceConfigCategory.create({ name: 'category3', siteFileName: 'xml', canAddProperty: false})
          ]
        }
      },
      {
        title: 'selectedConfigGroup is default group',
        result: {
          'category1': true,
          'category2': true,
          'category3': false
        },
        selectedConfigGroup: {isDefault: true},
        selectedService: {
          serviceName: 'TEST',
          configCategories: [
            App.ServiceConfigCategory.create({ name: 'category1', canAddProperty: true}),
            App.ServiceConfigCategory.create({ name: 'category2', siteFileName: 'xml', canAddProperty: true}),
            App.ServiceConfigCategory.create({ name: 'category3', siteFileName: 'xml', canAddProperty: false})
          ]
        }
      },
      {
        title: 'selectedConfigGroup is not default group',
        result: {
          'category1': false,
          'category2': false
        },
        selectedConfigGroup: {},
        selectedService: {
          serviceName: 'TEST',
          configCategories: [
            App.ServiceConfigCategory.create({ name: 'category1', siteFileName: 'xml', canAddProperty: true}),
            App.ServiceConfigCategory.create({ name: 'category2', siteFileName: 'xml', canAddProperty: false})
          ]
        }
      }
    ];
    describe('#checkCanEdit', function () {
      testCases.forEach(function (test) {
        it(test.title, function () {
          controller.set('selectedService', test.selectedService);
          controller.set('selectedConfigGroup', test.selectedConfigGroup);
          view.checkCanEdit();
          controller.get('selectedService.configCategories').forEach(function (category) {
            expect(category.get('canAddProperty')).to.equal(test.result[category.get('name')]);
          });
        });
      });
    });
  });

  describe('App.ServiceConfigsByCategoryView', function () {

    var view = App.ServiceConfigsByCategoryView.create({
      serviceConfigs: []
    });

    var result = [1, 2, 3, 4];

    var testData = [
      {
        title: 'four configs in correct order',
        configs: [
          Em.Object.create({index: 1, resultId: 1}),
          Em.Object.create({index: 2, resultId: 2}),
          Em.Object.create({index: 3, resultId: 3}),
          Em.Object.create({index: 4, resultId: 4})
        ]
      },
      {
        title: 'four configs in reverse order',
        configs: [
          Em.Object.create({index: 4, resultId: 4}),
          Em.Object.create({index: 3, resultId: 3}),
          Em.Object.create({index: 2, resultId: 2}),
          Em.Object.create({index: 1, resultId: 1})
        ]
      },
      {
        title: 'four configs in random order',
        configs: [
          Em.Object.create({index: 3, resultId: 3}),
          Em.Object.create({index: 4, resultId: 4}),
          Em.Object.create({index: 1, resultId: 1}),
          Em.Object.create({index: 2, resultId: 2})
        ]
      },
      {
        title: 'four configs with no index',
        configs: [
          Em.Object.create({resultId: 1}),
          Em.Object.create({resultId: 2}),
          Em.Object.create({resultId: 3}),
          Em.Object.create({resultId: 4})
        ]
      },
      {
        title: 'four configs but one with index',
        configs: [
          Em.Object.create({resultId: 2}),
          Em.Object.create({resultId: 3}),
          Em.Object.create({resultId: 4}),
          Em.Object.create({index: 1, resultId: 1})
        ]
      },
      {
        title: 'index is null or not number',
        configs: [
          Em.Object.create({index: null, resultId: 3}),
          Em.Object.create({index: 1, resultId: 1}),
          Em.Object.create({index: 2, resultId: 2}),
          Em.Object.create({index: 'a', resultId: 4})
        ]
      },
      {
        title: 'four configs when indexes skipped',
        configs: [
          Em.Object.create({index: 88, resultId: 3}),
          Em.Object.create({index: 67, resultId: 2}),
          Em.Object.create({index: 111, resultId: 4}),
          Em.Object.create({index: 3, resultId: 1})
        ]
      }
    ];

    describe('#sortByIndex', function () {
      testData.forEach(function(_test){
        it(_test.title, function () {
          expect(view.sortByIndex(_test.configs).mapProperty('resultId')).to.deep.equal(result);
        })
      })
    });

    describe('#updateReadOnlyFlags', function () {
      it('if canEdit is true then isEditable flag of configs shouldn\'t be changed', function () {
        view.set('canEdit', true);
        view.set('serviceConfigs', [
          Em.Object.create({
            name: 'config1',
            isEditable: true
          }),
          Em.Object.create({
            name: 'config2',
            isEditable: false
          })
        ]);
        view.updateReadOnlyFlags();
        expect(view.get('serviceConfigs').findProperty('name', 'config1').get('isEditable')).to.equal(true);
        expect(view.get('serviceConfigs').findProperty('name', 'config2').get('isEditable')).to.equal(false);
      });
      it('if canEdit is false then configs shouldn\'t be editable', function () {
        view.set('canEdit', false);
        view.set('serviceConfigs', [
          Em.Object.create({
            name: 'config1',
            isEditable: true
          }),
          Em.Object.create({
            name: 'config2',
            isEditable: false
          })
        ]);
        view.updateReadOnlyFlags();
        expect(view.get('serviceConfigs').findProperty('name', 'config1').get('isEditable')).to.equal(false);
        expect(view.get('serviceConfigs').findProperty('name', 'config2').get('isEditable')).to.equal(false);
      });
      it('if canEdit is false then config overrides shouldn\'t be editable', function () {
        view.set('canEdit', false);
        view.set('serviceConfigs', [
          Em.Object.create({
            name: 'config',
            isEditable: true,
            overrides: [
              Em.Object.create({
                name: 'override1',
                isEditable: true
              }),
              Em.Object.create({
                name: 'override2',
                isEditable: false
              })
            ]
          })
        ]);
        view.updateReadOnlyFlags();
        var overrides = view.get('serviceConfigs').findProperty('name', 'config').get('overrides');
        expect(overrides.findProperty('name', 'override1').get('isEditable')).to.equal(false);
        expect(overrides.findProperty('name', 'override2').get('isEditable')).to.equal(false);
      });
      it('if canEdit is true then isEditable flag of overrides shouldn\'t be changed', function () {
        view.set('canEdit', true);
        view.set('serviceConfigs', [
          Em.Object.create({
            name: 'config',
            isEditable: true,
            overrides: [
              Em.Object.create({
                name: 'override1',
                isEditable: true
              }),
              Em.Object.create({
                name: 'override2',
                isEditable: false
              })
            ]
          })
        ]);
        view.updateReadOnlyFlags();
        var overrides = view.get('serviceConfigs').findProperty('name', 'config').get('overrides');
        expect(overrides.findProperty('name', 'override1').get('isEditable')).to.equal(true);
        expect(overrides.findProperty('name', 'override2').get('isEditable')).to.equal(false);
      })
    })
  });
  
});
window.require.register("test/views/common/filter_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  var filters = require('views/common/filter_view');

  describe('filters.getFilterByType', function () {


    describe('ambari-bandwidth', function () {

      var filter = filters.getFilterByType('ambari-bandwidth');
      var testData = [
        {
          condition: '<',
          value: 'any value',
          result: true
        },
        {
          condition: '=',
          value: 'any value',
          result: true
        },
        {
          condition: '>',
          value: 'any value',
          result: true
        },
        {
          condition: '1',
          value: '1GB',
          result: true
        },
        {
          condition: '1g',
          value: '1GB',
          result: true
        },
        {
          condition: '=1g',
          value: '1GB',
          result: true
        },
        {
          condition: '<1g',
          value: '0.9GB',
          result: true
        },
        {
          condition: '>1g',
          value: '1.1GB',
          result: true
        },
        {
          condition: '=1k',
          value: '1KB',
          result: true
        },
        {
          condition: '<1k',
          value: '0.9KB',
          result: true
        },
        {
          condition: '>1k',
          value: '1.1KB',
          result: true
        },
        {
          condition: '=1m',
          value: '1MB',
          result: true
        },
        {
          condition: '<1m',
          value: '0.9MB',
          result: true
        },
        {
          condition: '>1m',
          value: '1.1MB',
          result: true
        },
        {
          condition: '=1024k',
          value: '1MB',
          result: true
        },
        {
          condition: '=1024m',
          value: '1GB',
          result: true
        }
      ];

      testData.forEach(function(item){
        it('Condition: ' + item.condition + ' - match value: ' + item.value, function () {
          expect(filter(item.value, item.condition)).to.equal(item.result);
        })
      });
    });

    describe('duration', function () {

      var filter = filters.getFilterByType('duration');
      var testData = [
        {
          condition: '<',
          value: 'any value',
          result: true
        },
        {
          condition: '=',
          value: 'any value',
          result: true
        },
        {
          condition: '>',
          value: 'any value',
          result: true
        },
        {
          condition: '1',
          value: '1000',
          result: true
        },
        {
          condition: '1s',
          value: '1000',
          result: true
        },
        {
          condition: '=1s',
          value: '1000',
          result: true
        },
        {
          condition: '>1s',
          value: '1001',
          result: true
        },
        {
          condition: '<1s',
          value: '999',
          result: true
        },
        {
          condition: '=1m',
          value: '60000',
          result: true
        },
        {
          condition: '>1m',
          value: '60001',
          result: true
        },
        {
          condition: '<1m',
          value: '59999',
          result: true
        },
        {
          condition: '=1h',
          value: '3600000',
          result: true
        },
        {
          condition: '>1h',
          value: '3600001',
          result: true
        },
        {
          condition: '<1h',
          value: '3599999',
          result: true
        }

      ];

      testData.forEach(function(item){
        it('Condition: ' + item.condition + ' - match value: ' + item.value, function () {
          expect(filter(item.value, item.condition)).to.equal(item.result);
        })
      });
    });

    describe('date', function () {

      var filter = filters.getFilterByType('date');
      var currentTime = new Date().getTime();
      var testData = [
        {
          condition: 'Past 1 Day',
          value: currentTime - 86300000,
          result: true
        },
        {
          condition: 'Past 2 Days',
          value: currentTime - 172700000,
          result: true
        },
        {
          condition: 'Past 7 Days',
          value: currentTime - 604700000,
          result: true
        },
        {
          condition: 'Past 14 Days',
          value: currentTime - 1209500000,
          result: true
        },
        {
          condition: 'Past 30 Days',
          value: currentTime - 2591900000,
          result: true
        },
        {
          condition: 'Any',
          value: 'any value',
          result: true
        }
      ];

      testData.forEach(function(item){
        it('Condition: ' + item.condition + ' - match value: ' + item.value, function () {
          expect(filter(item.value, item.condition)).to.equal(item.result);
        })
      });
    });

    describe('number', function () {

      var filter = filters.getFilterByType('number');
      var testData = [
        {
          condition: '<',
          value: 'any value',
          result: true
        },
        {
          condition: '=',
          value: 'any value',
          result: true
        },
        {
          condition: '>',
          value: 'any value',
          result: true
        },
        {
          condition: '1',
          value: '1',
          result: true
        },
        {
          condition: '=1',
          value: '1',
          result: true
        },
        {
          condition: '<1',
          value: '0',
          result: true
        },
        {
          condition: '>1',
          value: '2',
          result: true
        }
      ];

      testData.forEach(function(item){
        it('Condition: ' + item.condition + ' - match value: ' + item.value, function () {
          expect(filter(item.value, item.condition)).to.equal(item.result);
        })
      });
    });

    describe('multiple', function () {

      var filter = filters.getFilterByType('multiple');
      var commonValue = [
        {componentName: 'DATANODE'},
        {componentName: 'NAMENODE'},
        {componentName: 'JOBTRACKER'}
      ];
      var testData = [
        {
          condition: 'DATANODE',
          value: commonValue,
          result: true
        },
        {
          condition: 'DATANODE,NAMENODE',
          value: commonValue,
          result: true
        },
        {
          condition: 'DATANODE,NAMENODE,JOBTRACKER',
          value: commonValue,
          result: true
        },
        {
          condition: 'JOBTRACKER,TASKTRACKER',
          value: commonValue,
          result: true
        },
        {
          condition: 'TASKTRACKER',
          value: commonValue,
          result: false
        }
      ];

      testData.forEach(function(item){
        it('Condition: ' + item.condition + ((item.result) ? ' - match ' : ' - doesn\'t match ' + 'value: ') +
          item.value.mapProperty('componentName').join(" "), function () {
          expect(filter(item.value, item.condition)).to.equal(item.result);
        })
      });
    });

    describe('string', function () {

      var filter = filters.getFilterByType('string');

      var testData = [
        {
          condition: '',
          value: '',
          result: true
        },
        {
          condition: '',
          value: 'hello',
          result: true
        },
        {
          condition: 'hello',
          value: 'hello',
          result: true
        },
        {
          condition: 'HeLLo',
          value: 'hello',
          result: true
        },
        {
          condition: 'he',
          value: 'hello',
          result: true
        },
        {
          condition: 'lo',
          value: 'hello',
          result: true
        },
        {
          condition: 'lol',
          value: 'hello',
          result: false
        },
        {
          condition: 'hello',
          value: '',
          result: false
        }
      ];

      testData.forEach(function(item){
        it('Condition: ' + item.condition + ((item.result) ? ' - match ' : ' - doesn\'t match ' + 'value: ') + item.value, function () {
          expect(filter(item.value, item.condition)).to.equal(item.result);
        })
      });
    });
  });
  
});
window.require.register("test/views/common/quick_link_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/common/quick_view_link_view');

  describe('App.QuickViewLinks', function () {

    var quickViewLinks = App.QuickViewLinks.create({});

    describe('#setPort', function () {
      var testData = [
        Em.Object.create({
          'service_id': 'YARN',
          'protocol': 'http',
          'result': '8088',
          'default_http_port': '8088',
          'default_https_port': '8090',
          'regex': '\\w*:(\\d+)'
        }),
        Em.Object.create({
          'service_id': 'YARN',
          'protocol': 'https',
          'https_config': 'https_config',
          'result': '8090',
          'default_http_port': '8088',
          'default_https_port': '8090',
          'regex': '\\w*:(\\d+)'
        }),
        Em.Object.create({
          'service_id': 'YARN',
          'protocol': 'https',
          'https_config': 'https_config',
          'result': '8090',
          'default_http_port': '8088',
          'default_https_port': '8090',
          'regex': '\\w*:(\\d+)'
        })
      ];

      testData.forEach(function(item) {
        it(item.service_id + ' ' + item.protocol, function () {
          expect(quickViewLinks.setPort(item, item.protocol, item.version)).to.equal(item.result);
        })
      },this);
    });
  });
  
});
window.require.register("test/views/common/rolling_restart_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/common/rolling_restart_view');

  describe('App.RollingRestartView', function () {

    var view = App.RollingRestartView.create({
      restartHostComponents: []
    });

    describe('#initialize', function () {
      var testCases = [
        {
          restartHostComponents: [],
          result: {
            batchSize: 1,
            tolerateSize: 1
          }
        },
        {
          restartHostComponents: new Array(10),
          result: {
            batchSize: 1,
            tolerateSize: 1
          }
        },
        {
          restartHostComponents: new Array(11),
          result: {
            batchSize: 2,
            tolerateSize: 2
          }
        },
        {
          restartHostComponents: new Array(20),
          result: {
            batchSize: 2,
            tolerateSize: 2
          }
        }
      ];

      testCases.forEach(function (test) {
        it(test.restartHostComponents.length + ' components to restart', function () {
          view.set('batchSize', -1);
          view.set('interBatchWaitTimeSeconds', -1);
          view.set('tolerateSize', -1);
          view.set('restartHostComponents', test.restartHostComponents);
          view.initialize();
          expect(view.get('batchSize')).to.equal(test.result.batchSize);
          expect(view.get('tolerateSize')).to.equal(test.result.tolerateSize);
        })
      }, this);
    });
  });
  
});
window.require.register("test/views/common/table_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('utils/db');
  require('views/common/filter_view');
  require('views/common/sort_view');
  require('mixins');
  require('mixins/common/userPref');
  require('views/common/table_view');

  describe('App.TableView', function () {

    var view;

    beforeEach(function() {
      App.db.cleanUp();
    });

    afterEach(function() {
      App.db.cleanUp();
    });

    describe('#updatePaging', function() {

      beforeEach(function() {
        view = App.TableView.create(App.UserPref, {
          controller: Em.Object.create({}),
          displayLength: 10,
          startIndex: 1,
          content: d3.range(1, 100),
          filteredContent: d3.range(1, 100),
          filtersUsedCalc: function() {},
          filter: function() {}
        });
        view.clearFilters();
        view.updateFilter();
      });

      it('should set "startIndex" to 0 if "filteredContent" is empty', function() {
        view.set('filteredContent', []);
        expect(view.get('startIndex')).to.equal(0);
      });

      it('should set "startIndex" to 1 if "filteredContent" is not empty', function() {
        view.set('filteredContent', d3.range(1, 10));
        expect(view.get('startIndex')).to.equal(1);
      });

    });

    describe('#endIndex', function() {

      beforeEach(function() {
        view = App.TableView.create(App.UserPref, {
          controller: Em.Object.create({}),
          displayLength: 10,
          startIndex: 1,
          content: d3.range(1, 100),
          filteredContent: d3.range(1, 100),
          filtersUsedCalc: function() {},
          filter: function() {}
        });
        view.clearFilters();
        view.updateFilter();
      });

      it('should be recalculated if "startIndex" was changed', function() {
        view.set('startIndex', 2);
        expect(view.get('endIndex')).to.equal(11);
      });

      it('should be recalculated if "displayLength" was changed', function() {
        view.set('displayLength', 5);
        expect(view.get('endIndex')).to.equal(5);
      });

      it('should be recalculated (but not changed) if "filteredContent" was changed (and "filterContent.length" is more than "startIndex + displayLength")', function() {
        var endIndexBefore = view.get('endIndex');
        view.set('filteredContent', d3.range(2,100));
        expect(view.get('endIndex')).to.equal(endIndexBefore);
      });

      it('should be recalculated (and changed) if "filteredContent" was changed (and "filterContent.length" is less than "startIndex + displayLength")', function() {
        var endIndexBefore = view.get('endIndex');
        var indx = 4;
        view.set('filteredContent', d3.range(1,indx));
        expect(view.get('endIndex')).to.not.equal(endIndexBefore);
        expect(view.get('endIndex')).to.equal(indx - 1);
      });

    });

    describe('#pageContent', function() {

      beforeEach(function() {
        view = App.TableView.create(App.UserPref, {
          controller: Em.Object.create({}),
          displayLength: 10,
          startIndex: 1,
          content: d3.range(1, 100),
          filteredContent: d3.range(1, 100),
          endIndex: 10,
          filtersUsedCalc: function() {},
          filter: function() {}
        });
        view.clearFilters();
        view.updateFilter();
      });

      it('should be recalculated if "startIndex" was changed', function() {
        view.set('startIndex', 2);
        expect(view.get('pageContent').length).to.equal(9);
      });

      it('should be recalculated if "endIndex" was changed', function() {
        view.set('endIndex', 5);
        expect(view.get('pageContent').length).to.equal(5);
      });

      it('should be recalculated if "filteredContent" was changed', function() {
        var pageContentBefore = view.get('pageContent');
        view.set('filteredContent', d3.range(2,100));
        expect(view.get('pageContent').length).to.equal(pageContentBefore.length);
        expect(view.get('pageContent')).to.not.eql(pageContentBefore);
      });

    });

    describe('#clearFilters', function() {

      it('should set "filterConditions" to empty array', function() {
        view.clearFilters();
        expect(view.get('filterConditions')).to.eql([]);
      });

    });

    describe('#filtersUsedCalc', function() {

      beforeEach(function() {
        view = App.TableView.create(App.UserPref, {
          controller: Em.Object.create({}),
          displayLength: 10,
          startIndex: 1,
          content: d3.range(1, 100),
          filteredContent: d3.range(1, 100),
          endIndex: 10,
          filter: function() {}
        });
      });

      it('should set "filtersUsed" to false if "filterConditions" is empty array', function() {
        view.set('filterConditions', []);
        view.filtersUsedCalc();
        expect(view.get('filtersUsed')).to.equal(false);
      });

      it('should set "filtersUsed" to false if each value in "filterConditions" is empty', function() {
        view.set('filterConditions', [{value:''}, {value:''}]);
        view.filtersUsedCalc();
        expect(view.get('filtersUsed')).to.equal(false);
      });

      it('should set "filtersUsed" to true if one or more values in "filterConditions" are not empty', function() {
        view.set('filterConditions', [{value:''}, {value:'lol'}]);
        view.filtersUsedCalc();
        expect(view.get('filtersUsed')).to.equal(true);
      });

    });

    describe('#nextPage', function() {

      beforeEach(function() {
        view = App.TableView.create(App.UserPref, {
          controller: Em.Object.create({}),
          displayLength: 10,
          startIndex: 1,
          content: d3.range(1, 100),
          filteredContent: d3.range(1, 100),
          endIndex: 10,
          filter: function() {}
        });
      });

      it('should set "startIndex" if "filteredContent.length is greater than "startIndex" + "displayLength"', function() {
        var oldStartIndex = view.get('startIndex');
        var displayLength = 50;
        view.set('displayLength', displayLength);
        view.nextPage();
        expect(view.get('startIndex')).to.equal(oldStartIndex + displayLength);
      });

      it('should not set "startIndex" if "filteredContent.length is equal to "startIndex" + "displayLength"', function() {
        var oldStartIndex = view.get('startIndex');
        var displayLength = 99;
        view.set('displayLength', displayLength);
        view.nextPage();
        expect(view.get('startIndex')).to.equal(oldStartIndex);
      });

      it('should not set "startIndex" if "filteredContent.length is less than "startIndex" + "displayLength"', function() {
        var oldStartIndex = view.get('startIndex');
        var displayLength = 100;
        view.set('displayLength', displayLength);
        view.nextPage();
        expect(view.get('startIndex')).to.equal(oldStartIndex);
      });

    });

    describe('#previousPage', function() {

      beforeEach(function() {
        view = App.TableView.create(App.UserPref, {
          controller: Em.Object.create({}),
          displayLength: 10,
          startIndex: 50,
          content: d3.range(1, 100),
          filteredContent: d3.range(1, 100),
          endIndex: 60,
          filter: function() {}
        });
      });

      it('should set "startIndex" to 1', function() {
        var displayLength = 50;
        view.set('displayLength', displayLength);
        view.previousPage();
        expect(view.get('startIndex')).to.equal(1);
      });

      it('should not set "startIndex" to 40', function() {
        view.set('startIndex', 50);
        var displayLength = 10;
        view.set('displayLength', displayLength);
        view.previousPage();
        expect(view.get('startIndex')).to.equal(40);
      });

    });

  });
  
});
window.require.register("test/views/main/charts/heatmap/heatmap_host_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('views/main/charts/heatmap/heatmap_host');

  describe('App.MainChartsHeatmapHostView', function() {

    var view = App.MainChartsHeatmapHostView.create({
      templateName: '',
      controller: Em.Object.create(),
      content: {}
    });

    describe('#hostTemperatureStyle', function () {
      var testCases = [
        {
          title: 'if hostToSlotMap is null then hostTemperatureStyle should be empty',
          hostName: 'host',
          controller: Em.Object.create({
            hostToSlotMap: null,
            selectedMetric: {
              slotDefinitions: []
            }
          }),
          result: ''
        },
        {
          title: 'if hostName is null then hostTemperatureStyle should be empty',
          hostName: '',
          controller: Em.Object.create({
            hostToSlotMap: {},
            selectedMetric: {
              slotDefinitions: []
            }
          }),
          result: ''
        },
        {
          title: 'if slot less than 0 then hostTemperatureStyle should be empty',
          hostName: 'host1',
          controller: Em.Object.create({
            hostToSlotMap: {
              "host1": -1
            },
            selectedMetric: {
              slotDefinitions: []
            }
          }),
          result: ''
        },
        {
          title: 'if slotDefinitions is null then hostTemperatureStyle should be empty',
          hostName: 'host1',
          controller: Em.Object.create({
            hostToSlotMap: {
              "host1": 1
            },
            selectedMetric: {
              slotDefinitions: null
            }
          }),
          result: ''
        },
        {
          title: 'if slotDefinitions length not more than slot number then hostTemperatureStyle should be empty',
          hostName: 'host1',
          controller: Em.Object.create({
            hostToSlotMap: {
              "host1": 1
            },
            selectedMetric: {
              slotDefinitions: [{}]
            }
          }),
          result: ''
        },
        {
          title: 'if slotDefinitions correct then hostTemperatureStyle should be "style1"',
          hostName: 'host1',
          controller: Em.Object.create({
            hostToSlotMap: {
              "host1": 1
            },
            selectedMetric: {
              slotDefinitions: [
                Em.Object.create({cssStyle: 'style0'}),
                Em.Object.create({cssStyle: 'style1'})
              ]
            }
          }),
          result: 'style1'
        }
      ];
      testCases.forEach(function (test) {
        it(test.title, function () {
          view.set('content.hostName', test.hostName);
          view.set('controller', test.controller);
          expect(view.get('hostTemperatureStyle')).to.equal(test.result);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/charts/heatmap/heatmap_rack_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('views/main/charts/heatmap/heatmap_rack');

  describe('App.MainChartsHeatmapRackView', function() {

    var view = App.MainChartsHeatmapRackView.create({
      templateName: ''
    });

    describe('#hostCssStyle', function () {
      var testCases = [
        {
          title: 'if hosts number is zero then hostCssStyle should be have width 10%',
          rack: Em.Object.create({
            hosts: new Array(0)
          }),
          result: "width:10%;float:left;"
        },
        {
          title: 'if hosts number is one then hostCssStyle should be have width 99.5%',
          rack: Em.Object.create({
            hosts: new Array(1)
          }),
          result: "width:99.5%;float:left;"
        },
        {
          title: 'if hosts number is ten then hostCssStyle should be have width 9.5%',
          rack: Em.Object.create({
            hosts: new Array(10)
          }),
          result: "width:9.5%;float:left;"
        },
        {
          title: 'if hosts number is ten then hostCssStyle should be have width 10%',
          rack: Em.Object.create({
            hosts: new Array(11)
          }),
          result: "width:10%;float:left;"
        }
      ];
      testCases.forEach(function (test) {
        it(test.title, function () {
          view.set('rack', test.rack);
          expect(view.get('hostCssStyle')).to.equal(test.result);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widget_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/main/dashboard/widget');

  describe('App.DashboardWidgetView', function() {
    var dashboardWidgetView = App.DashboardWidgetView.create();

    describe('#viewID', function() {
      it('viewID is computed with id', function() {
        dashboardWidgetView.set('id', 5);
        expect(dashboardWidgetView.get('viewID')).to.equal('widget-5');
      });
    });

    describe('#hoverContentTopClass', function() {
      var tests = [
        {
          h: ['', ''],
          e: 'content-hidden-two-line',
          m: '2 lines'
        },
        {
          h: ['', '', ''],
          e: 'content-hidden-three-line',
          m: '3 lines'
        },
        {
          h: [''],
          e: '',
          m: '1 line'
        },
        {
          h: [],
          e: '',
          m: '0 lines'
        },
        {
          h: ['', '', '', '', ''],
          e: 'content-hidden-five-line',
          m: '5 lines'
        },
        {
          h: ['', '', '', ''],
          e: 'content-hidden-four-line',
          m: '4 lines'
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          dashboardWidgetView.set('hiddenInfo', test.h);
          expect(dashboardWidgetView.get('hoverContentTopClass')).to.equal(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/datanode_live_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widgets/datanode_live');

  describe('App.DataNodeUpView', function() {

    var tests = [
      {
        data: 100,
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true
        }
      },
      {
        data: 0,
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false
        }
      },
      {
        data: 50,
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false
        }
      }
    ];

    tests.forEach(function(test) {
      describe('', function() {
        var dataNodeUpView = App.DataNodeUpView.create({model_type:null, data: test.data, content: test.data.toString()});
        it('isRed', function() {
          expect(dataNodeUpView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(dataNodeUpView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(dataNodeUpView.get('isGreen')).to.equal(test.e.isGreen);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/hbase_average_load_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widgets/hbase_average_load');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.HBaseAverageLoadView', function() {

    var tests = [
      {
        model: {
          averageLoad: 1
        },
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false,
          isNA: false,
          content: '1'
        }
      },
      {
        model: {
          averageLoad: 10
        },
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: false,
          content: '10'
        }
      },
      {
        model: {
          averageLoad: 0
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '0'
        }
      },
      {
        model: {
          averageLoad: null
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable')
        }
      }
    ];

    tests.forEach(function(test) {
      describe('averageLoad - ' + test.model.averageLoad, function() {
        var hBaseAverageLoadView = App.HBaseAverageLoadView.create({model_type:null, model: test.model});
        it('content', function() {
          expect(hBaseAverageLoadView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(hBaseAverageLoadView.get('data')).to.equal(test.model.averageLoad);
        });
        it('isRed', function() {
          expect(hBaseAverageLoadView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(hBaseAverageLoadView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(hBaseAverageLoadView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(hBaseAverageLoadView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/hbase_master_uptime_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widgets/hbase_master_uptime');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.HBaseMasterUptimeView', function() {

    var tests = [
      {
        model: Em.Object.create({
          masterStartTime: ((new Date()).getTime() - 192.1*24*3600*1000)
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '192.1 d',
          data: 192.1
        }
      },
      {
        model:  Em.Object.create({
          masterStartTime: 0
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      },
      {
        model:  Em.Object.create({
          masterStartTime: null
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      }
    ];

    tests.forEach(function(test) {
      var hBaseMasterUptimeView = App.HBaseMasterUptimeView.create({model_type:null, model: test.model});
      hBaseMasterUptimeView.calc();
      describe('masterStartTime - ' + test.model.masterStartTime, function() {
        it('content', function() {
          expect(hBaseMasterUptimeView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(hBaseMasterUptimeView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(hBaseMasterUptimeView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(hBaseMasterUptimeView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(hBaseMasterUptimeView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(hBaseMasterUptimeView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/hbase_regions_in_transition_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('views/main/dashboard/widgets/hbase_regions_in_transition');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.HBaseRegionsInTransitionView', function() {

    var tests = [
      {
        model: {
          regionsInTransition: 1
        },
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false,
          isNA: false,
          content: '1'
        }
      },
      {
        model: {
          regionsInTransition: 10
        },
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: false,
          content: '10'
        }
      },
      {
        model: {
          regionsInTransition: 0
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '0'
        }
      },
      {
        model: {
          regionsInTransition: null
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: true,
          content: 'null'
        }
      }
    ];

    tests.forEach(function(test) {
      describe('regionsInTransition - ' + test.model.regionsInTransition, function() {
        var hBaseRegionsInTransitionView = App.HBaseRegionsInTransitionView.create({model_type:null, model: test.model});
        it('content', function() {
          expect(hBaseRegionsInTransitionView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(hBaseRegionsInTransitionView.get('data')).to.equal(test.model.regionsInTransition);
        });
        it('isRed', function() {
          expect(hBaseRegionsInTransitionView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(hBaseRegionsInTransitionView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(hBaseRegionsInTransitionView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(hBaseRegionsInTransitionView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/jobtracker_rpc_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widgets/jobtracker_rpc');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.JobTrackerRpcView', function() {

    var tests = [
      {
        model: {
          jobTrackerRpc: 1
        },
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false,
          isNA: false,
          content: '1.00 ms',
          data: '1.00'
        }
      },
      {
        model: {
          jobTrackerRpc: 10
        },
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: false,
          content: '10.00 ms',
          data: '10.00'
        }
      },
      {
        model: {
          jobTrackerRpc: 0
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '0 ms',
          data: 0
        }
      },
      {
        model: {
          jobTrackerRpc: null
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      }
    ];

    tests.forEach(function(test) {
      describe('jobTrackerRpc - ' + test.model.jobTrackerRpc, function() {
        var jobTrackerRpcView = App.JobTrackerRpcView.create({model_type:null, model: test.model});
        it('content', function() {
          expect(jobTrackerRpcView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(jobTrackerRpcView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(jobTrackerRpcView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(jobTrackerRpcView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(jobTrackerRpcView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(jobTrackerRpcView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/jobtracker_uptime_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widgets/jobtracker_uptime');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.JobTrackerUptimeView', function() {

    var tests = [
      {
        model: Em.Object.create({
          jobTrackerStartTime: ((new Date()).getTime() - 192.1*24*3600*1000)
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '192.1 d',
          data: 192.1
        }
      },
      {
        model: Em.Object.create({
          jobTrackerStartTime: 0
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      },
      {
        model: Em.Object.create({
          jobTrackerStartTime: null
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      }
    ];

    tests.forEach(function(test) {
      describe('jobTrackerStartTime - ' + test.model.jobTrackerStartTime, function() {
        var jobTrackerUptimeView = App.JobTrackerUptimeView.create({model_type:null, model: test.model});
        jobTrackerUptimeView.calc();
        it('content', function() {
          expect(jobTrackerUptimeView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(jobTrackerUptimeView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(jobTrackerUptimeView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(jobTrackerUptimeView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(jobTrackerUptimeView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(jobTrackerUptimeView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/links_widget_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('models/host_component');
  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/links_widget');

  describe('App.LinkDashboardWidgetView', function() {

    var model = Em.Object.create({
      field: Em.Object.create({
        publicHostName: 'host1'
      })
    });
    var linkDashboardWidgetView = App.LinkDashboardWidgetView.create({
      model_type: null,
      model: model,
      port: 1234,
      modelField: 'field'
    });
    linkDashboardWidgetView.calc();
    describe('#webUrl', function() {
      it('calc', function() {
        expect(linkDashboardWidgetView.get('webUrl')).to.equal('http://host1:1234');
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/namenode_cpu_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('utils/helper');
  require('views/common/chart/pie');
  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/pie_chart_widget');
  require('views/main/dashboard/widgets/namenode_cpu');

  describe('App.NameNodeCpuPieChartView', function() {

    var model = Em.Object.create({
      used: null,
      max: null
    });
    var nameNodeCpuPieChartView = App.NameNodeCpuPieChartView.create({
      model_type: null,
      model: model,
      modelFieldUsed: 'used',
      modelFieldMax: 'max',
      widgetHtmlId: 'fake'
    });

    nameNodeCpuPieChartView.calc();

    describe('#calcIsPieExists', function() {
      var tests = [
        {
          model: Em.Object.create({
            used: 1
          }),
          e: true,
          m: 'Exists'
        },
        {
          model: Em.Object.create({
            used: 0
          }),
          e: true,
          m: 'Exists'
        },
        {
          model: Em.Object.create({}),
          e: false,
          m: 'Not exists'
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          nameNodeCpuPieChartView.set('model', test.model);
          expect(nameNodeCpuPieChartView.calcIsPieExists()).to.equal(test.e);
        });
      });
    });

    describe('calcDataForPieChart', function() {
      var tests = [
        {
          model: Em.Object.create({
            used: 0
          }),
          e: ['0.0', '0.00'],
          m: 'Nothing is used'
        },
        {
          model: Em.Object.create({
            used: 100
          }),
          e: ['100.0', '100.00'],
          m: 'All is used'
        },
        {
          model: Em.Object.create({
            used: 50
          }),
          e: ['50.0', '50.00'],
          m: 'Half is used'
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          nameNodeCpuPieChartView.set('model', test.model);
          expect(nameNodeCpuPieChartView.calcDataForPieChart()).to.eql(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/namenode_rpc_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widgets/namenode_rpc');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.NameNodeRpcView', function() {

    var tests = [
      {
        model: {
          nameNodeRpc: 1
        },
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false,
          isNA: false,
          content: '1.00 ms',
          data: '1.00'
        }
      },
      {
        model: {
          nameNodeRpc: 10
        },
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: false,
          content: '10.00 ms',
          data: '10.00'
        }
      },
      {
        model: {
          nameNodeRpc: 0
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '0 ms',
          data: 0
        }
      },
      {
        model: {
          nameNodeRpc: null
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      }
    ];

    tests.forEach(function(test) {
      describe('nameNodeRpc - ' + test.model.nameNodeRpc, function() {
        var jobTrackerRpcView = App.NameNodeRpcView.create({model_type:null, model: test.model});
        it('content', function() {
          expect(jobTrackerRpcView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(jobTrackerRpcView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(jobTrackerRpcView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(jobTrackerRpcView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(jobTrackerRpcView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(jobTrackerRpcView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/namenode_uptime_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widgets/namenode_uptime');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widget');

  describe('App.NameNodeUptimeView', function() {

    var tests = [
      {
        model: Em.Object.create({
          nameNodeStartTime: ((new Date()).getTime() - 192.1*24*3600*1000)
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '192.1 d',
          data: 192.1
        }
      },
      {
        model:  Em.Object.create({
          nameNodeStartTime: 0
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      },
      {
        model:  Em.Object.create({
          nameNodeStartTime: null
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      }
    ];

    tests.forEach(function(test) {
      var nameNodeUptimeView = App.NameNodeUptimeView.create({model_type:null, model: test.model});
      nameNodeUptimeView.calc();
      describe('nameNodeStartTime - ' + test.model.nameNodeStartTime, function() {
        it('content', function() {
          expect(nameNodeUptimeView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(nameNodeUptimeView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(nameNodeUptimeView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(nameNodeUptimeView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(nameNodeUptimeView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(nameNodeUptimeView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/node_managers_live_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widgets/node_managers_live');

  describe('App.NodeManagersLiveView', function() {

    var tests = [
      {
        model: {
          nodeManagerNodes: [{}, {}, {}],
          nodeManagerLiveNodes: [{}, {}]
        },
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false,
          isNA: false,
          content: '2/3',
          data: 67
        }
      },
      {
        model: {
          nodeManagerNodes: [{},{}],
          nodeManagerLiveNodes: [{},{}]
        },
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '2/2',
          data: 100
        }
      },
      {
        model: {
          nodeManagerNodes: [{}, {}],
          nodeManagerLiveNodes: []
        },
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: false,
          content: '0/2',
          data: 0.00
        }
      }
    ];

    tests.forEach(function(test) {
      describe('nodeManagerNodes length - ' + test.model.nodeManagerNodes.length + ' | nodeManagerLiveNodes length - ' + test.model.nodeManagerLiveNodes.length, function() {
        var AppNodeManagersLiveView = App.NodeManagersLiveView.extend({nodeManagersLive: test.model.nodeManagerLiveNodes});
        var nodeManagersLiveView = AppNodeManagersLiveView.create({model_type:null, model: test.model});
        it('content', function() {
          expect(nodeManagersLiveView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(nodeManagersLiveView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(nodeManagersLiveView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(nodeManagersLiveView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(nodeManagersLiveView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(nodeManagersLiveView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/pie_chart_widget_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('views/common/chart/pie');
  require('utils/helper');
  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/pie_chart_widget');

  describe('App.PieChartDashboardWidgetView', function() {

    var model = Em.Object.create({
      used: null,
      max: null
    });
    var pieChartDashboardWidgetView = App.PieChartDashboardWidgetView.create({
      model_type: null,
      model: model,
      modelFieldUsed: 'used',
      modelFieldMax: 'max',
      widgetHtmlId: 'fake'
    });

    pieChartDashboardWidgetView.calc();

    describe('#getUsed', function() {
      var tests = [
        {
          model: Em.Object.create({
            used: 1
          }),
          e: 1,
          m: '"Used" is set'
        },
        {
          model: Em.Object.create({
            used: null
          }),
          e: 0,
          m: '"Used" is not set'
        },
        {
          model: Em.Object.create({}),
          e: 0,
          m: '"Used" is not defined'
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          pieChartDashboardWidgetView.set('model', test.model);
          expect(pieChartDashboardWidgetView.getUsed()).to.equal(test.e);
        });
      });
    });

    describe('#getMax', function() {
      var tests = [
        {
          model: Em.Object.create({
            max: 1
          }),
          e: 1,
          m: '"Max" is set'
        },
        {
          model: Em.Object.create({
            max: null
          }),
          e: 0,
          m: '"Max" is not set'
        },
        {
          model: Em.Object.create({}),
          e: 0,
          m: '"Max" is not defined'
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          pieChartDashboardWidgetView.set('model', test.model);
          expect(pieChartDashboardWidgetView.getMax()).to.equal(test.e);
        });
      });
    });

    describe('#calcIsPieExists', function() {
      var tests = [
        {
          model: Em.Object.create({
            max: 1
          }),
          e: true,
          m: 'Exists'
        },
        {
          model: Em.Object.create({
            max: 0
          }),
          e: false,
          m: 'Not exists'
        },
        {
          model: Em.Object.create({}),
          e: false,
          m: 'Not exists'
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          pieChartDashboardWidgetView.set('model', test.model);
          expect(pieChartDashboardWidgetView.calcIsPieExists()).to.equal(test.e);
        });
      });
    });

    describe('calcDataForPieChart', function() {
      var tests = [
        {
          model: Em.Object.create({
            max: 10,
            used: 0
          }),
          e: ['0', '0.0'],
          m: 'Nothing is used'
        },
        {
          model: Em.Object.create({
            max: 10,
            used: 10
          }),
          e: ['100', '100.0'],
          m: 'All is used'
        },
        {
          model: Em.Object.create({
            max: 10,
            used: 5
          }),
          e: ['50', '50.0'],
          m: 'Half is used'
        }
      ];

      tests.forEach(function(test) {
        it(test.m, function() {
          pieChartDashboardWidgetView.set('model', test.model);
          expect(pieChartDashboardWidgetView.calcDataForPieChart()).to.eql(test.e);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/resource_manager_uptime_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('messages');
  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widgets/resource_manager_uptime');

  describe('App.ResourceManagerUptimeView', function() {

    var tests = [
      {
        model: Em.Object.create({
          resourceManagerStartTime: ((new Date()).getTime() - 192.1*24*3600*1000)
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false,
          content: '192.1 d',
          data: 192.1
        }
      },
      {
        model:  Em.Object.create({
          resourceManagerStartTime: 0
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      },
      {
        model:  Em.Object.create({
          resourceManagerStartTime: null
        }),
        e: {
          isRed: false,
          isOrange: false,
          isGreen: false,
          isNA: true,
          content: Em.I18n.t('services.service.summary.notAvailable'),
          data: null
        }
      }
    ];

    tests.forEach(function(test) {
      var resourceManagerUptimeView = App.ResourceManagerUptimeView.create({model_type:null, model: test.model});
      resourceManagerUptimeView.calc();
      describe('resourceManagerStartTime - ' + test.model.resourceManagerStartTime, function() {
        it('content', function() {
          expect(resourceManagerUptimeView.get('content')).to.equal(test.e.content);
        });
        it('data', function() {
          expect(resourceManagerUptimeView.get('data')).to.equal(test.e.data);
        });
        it('isRed', function() {
          expect(resourceManagerUptimeView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(resourceManagerUptimeView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(resourceManagerUptimeView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(resourceManagerUptimeView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/tasktracker_live_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widgets/tasktracker_live');

  describe('App.TaskTrackerUpView', function() {

    var tests = [
      {
        data: 100,
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true
        }
      },
      {
        data: 0,
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false
        }
      },
      {
        data: 50,
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false
        }
      }
    ];

    tests.forEach(function(test) {
      describe('', function() {
        var taskTrackerUpView = App.TaskTrackerUpView.create({model_type:null, data: test.data, content: test.data.toString()});
        it('isRed', function() {
          expect(taskTrackerUpView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(taskTrackerUpView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(taskTrackerUpView.get('isGreen')).to.equal(test.e.isGreen);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/text_widget_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/text_widget');

  describe('App.TextDashboardWidgetView', function() {

    var tests = [
      {
        data: 100,
        e: {
          isRed: false,
          isOrange: false,
          isGreen: true,
          isNA: false
        }
      },
      {
        data: 1,
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: false
        }
      },
      {
        data: 50,
        e: {
          isRed: false,
          isOrange: true,
          isGreen: false,
          isNA: false
        }
      },
      {
        data: null,
        e: {
          isRed: true,
          isOrange: false,
          isGreen: false,
          isNA: true
        }
      }
    ];

    tests.forEach(function(test) {
      describe('data - ' + test.data + ' | thresh1 - 40 | thresh2 - 70', function() {
        var textDashboardWidgetView = App.TextDashboardWidgetView.create({thresh1:40, thresh2:70});
        textDashboardWidgetView.set('data', test.data);
        it('isRed', function() {
          expect(textDashboardWidgetView.get('isRed')).to.equal(test.e.isRed);
        });
        it('isOrange', function() {
          expect(textDashboardWidgetView.get('isOrange')).to.equal(test.e.isOrange);
        });
        it('isGreen', function() {
          expect(textDashboardWidgetView.get('isGreen')).to.equal(test.e.isGreen);
        });
        it('isNA', function() {
          expect(textDashboardWidgetView.get('isNA')).to.equal(test.e.isNA);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard/widgets/uptime_text_widget_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');

  require('views/main/dashboard/widget');
  require('views/main/dashboard/widgets/text_widget');
  require('views/main/dashboard/widgets/uptime_text_widget');

  describe('App.UptimeTextDashboardWidgetView', function() {

    describe('#timeConverter', function() {
      var timestamps = [
        {
          t: 1358245370553,
          e: {
            l: 2,
            f: 'Tue Jan 15 2013'
          }
        },
        {
          t: 0,
          e: {
            l: 2,
            f: 'Thu Jan 01 1970'
          }
        }
      ];
      timestamps.forEach(function(timestamp) {
        var uptimeTextDashboardWidgetView = App.UptimeTextDashboardWidgetView.create({thresh1:40, thresh2:70});
        it('timestamp ' + timestamp.t, function() {
          var result = uptimeTextDashboardWidgetView.timeConverter(timestamp.t);
          expect(result.length).to.equal(timestamp.e.l);
          expect(result[0]).to.equal(timestamp.e.f);
        });
      });
    });

    describe('#uptimeProcessing', function() {
      var timestamps = [
        {
          t: (new Date()).getTime() - 10*1000,
          e: {
            timeUnit: 's'
          }
        },
        {
          t: (new Date()).getTime() - 3600*1000,
          e: {
            timeUnit: 'hr'
          }
        },
        {
          t: (new Date()).getTime() - 24*3600*1000,
          e: {
            timeUnit: 'd'
          }
        },
        {
          t: (new Date()).getTime() - 1800*1000,
          e: {
            timeUnit: 'min'
          }
        }
      ];
      timestamps.forEach(function(timestamp) {
        var uptimeTextDashboardWidgetView = App.UptimeTextDashboardWidgetView.create({thresh1:40, thresh2:70});
        it('timestamp ' + timestamp.t + '. timeUnit should be ' + '"' + timestamp.e.timeUnit + '"', function() {
          var result = uptimeTextDashboardWidgetView.uptimeProcessing(timestamp.t);
          expect(uptimeTextDashboardWidgetView.get('timeUnit')).to.equal(timestamp.e.timeUnit);
        });
      });
    });

  });
  
});
window.require.register("test/views/main/dashboard_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('messages');
  var filters = require('views/common/filter_view');
  require('views/main/dashboard');

  describe('App.MainDashboardView', function() {

    var mainDashboardView = App.MainDashboardView.create();

    describe('#setInitPrefObject', function() {
      var hdfs_widgets_count = 7;
      var mapreduce_widgets_count = 7;
      var hbase_widgets_count = 4;
      var yarn_widgets_count = 4;
      var total_widgets_count = 27;
      var tests = [
        {
          models: {
            hdfs_model: null,
            mapreduce_model: null,
            hbase_model: null,
            yarn_model: null
          },
          e: {
            visibleL: total_widgets_count - hdfs_widgets_count - mapreduce_widgets_count - hbase_widgets_count - yarn_widgets_count - 1,
            hiddenL: 0
          },
          m: 'All models are null'
        },
        {
          models: {
            hdfs_model: {},
            mapreduce_model: null,
            hbase_model: null,
            yarn_model: null
          },
          e: {
            visibleL: total_widgets_count  - mapreduce_widgets_count - hbase_widgets_count - yarn_widgets_count - 1,
            hiddenL: 0
          },
          m: 'mapreduce_model, hbase_model, yarn_model are null'
        },
        {
          models: {
            hdfs_model: {},
            mapreduce_model: {},
            hbase_model: null,
            yarn_model: null
          },
          e: {
            visibleL: total_widgets_count - hbase_widgets_count - yarn_widgets_count - 1,
            hiddenL: 0
          },
          m: 'hbase_model and yarn_model are null'
        },
        {
          models: {
            hdfs_model: {},
            mapreduce_model: {},
            hbase_model: {},
            yarn_model: null
          },
          e: {
            visibleL: total_widgets_count - yarn_widgets_count - 1,
            hiddenL: 1
          },
          m: 'yarn_model is null'
        },
        {
          models: {
            hdfs_model: {},
            mapreduce_model: {},
            hbase_model: {},
            yarn_model: {}
          },
          e: {
            visibleL: total_widgets_count - 1,
            hiddenL: 1
          },
          m: 'All models are not null'
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          mainDashboardView.set('hdfs_model', test.models.hdfs_model);
          mainDashboardView.set('mapreduce_model', test.models.mapreduce_model);
          mainDashboardView.set('hbase_model', test.models.hbase_model);
          mainDashboardView.set('yarn_model', test.models.yarn_model);
          mainDashboardView.setInitPrefObject();
          expect(mainDashboardView.get('initPrefObject.visible.length')).to.equal(test.e.visibleL);
          expect(mainDashboardView.get('initPrefObject.hidden.length')).to.equal(test.e.hiddenL);
        });
      });
    });

    describe('#persistKey', function() {
      App.router.set('loginName', 'tdk');
      it('Check it', function() {
        expect(mainDashboardView.get('persistKey')).to.equal('user-pref-tdk-dashboard');
      });
    });

  });
  
});
window.require.register("test/views/main/host/details/host_component_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/host_component');
  require('views/main/host/details/host_component_view');

  var hostComponentView;

  describe('App.HostComponentView', function() {

    beforeEach(function() {
      hostComponentView = App.HostComponentView.create({
        startBlinking: function(){},
        doBlinking: function(){},
        getDesiredAdminState: function(){return $.ajax({});}
      });
    });

    describe('#disabled', function() {

      var tests = Em.A([
        {
          parentView: {content: {healthClass: 'health-status-DEAD-YELLOW'}},
          e: 'disabled'
        },
        {
          parentView: {content: {healthClass: 'another-class'}},
          e: ''
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          hostComponentView = App.HostComponentView.create({
            startBlinking: function(){},
            doBlinking: function(){},
            parentView: test.parentView
          });
          expect(hostComponentView.get('disabled')).to.equal(test.e);
        });
      });

    });

    describe('#isUpgradeFailed', function() {

      var tests = ['UPGRADE_FAILED'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isUpgradeFailed')).to.equal(e);
        });
      });

    });

    describe('#isInstallFailed', function() {

      var tests = ['INSTALL_FAILED'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isInstallFailed')).to.equal(e);
        });
      });

    });

    describe('#isStart', function() {

      var tests = ['STARTED','STARTING'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isStart')).to.equal(e);
        });
      });

    });

    describe('#isStop', function() {

      var tests = ['INSTALLED'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isStop')).to.equal(e);
        });
      });

    });

    describe('#isInstalling', function() {

      var tests = ['INSTALLING'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isInstalling')).to.equal(e);
        });
      });

    });

    describe('#isInit', function() {

      var tests = ['INIT'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isInit')).to.equal(e);
        });
      });

    });

    describe('#noActionAvailable', function() {

      var tests = ['STARTING', 'STOPPING', 'UNKNOWN', 'DISABLED'];
      var testE = 'hidden';
      var defaultE = '';

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('noActionAvailable')).to.equal(e);
        });
      });

    });

    describe('#isActive', function() {

      var tests = Em.A([
        {passiveState: 'OFF', e: true},
        {passiveState: 'ON', e: false},
        {passiveState: 'IMPLIED', e: false}
      ]);

      tests.forEach(function(test) {
        it(test.workStatus, function() {
          hostComponentView.set('content', {passiveState: test.passiveState});
          expect(hostComponentView.get('isActive')).to.equal(test.e);
        });
      });

    });

    describe('#isImplied', function() {

      var tests = Em.A([
        {
          content: {service: {passiveState: 'ON'}},
          parentView: {content: {passiveState: 'ON'}},
          m: 'service in ON, host in ON',
          e: true
        },
        {
          content: {service: {passiveState: 'ON', serviceName:'SERVICE_NAME'}},
          parentView: {content: {passiveState: 'OFF'}},
          m: 'service in ON, host in OFF',
          e: true
        },
        {
          content: {service: {passiveState: 'OFF', serviceName:'SERVICE_NAME'}},
          parentView: {content: {passiveState: 'ON'}},
          m: 'service in OFF, host in ON',
          e: true
        },
        {
          content: {service: {passiveState: 'OFF'}},
          parentView: {content: {passiveState: 'OFF'}},
          m: 'service in OFF, host in OFF',
          e: false
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          hostComponentView = App.HostComponentView.create({
            startBlinking: function(){},
            doBlinking: function(){},
            parentView: test.parentView,
            content: test.content
          });
          expect(hostComponentView.get('isImplied')).to.equal(test.e);
        });
      });

    });

    describe('#isRestartComponentDisabled', function() {

      var tests = ['STARTED'];
      var testE = false;
      var defaultE = true;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isRestartComponentDisabled')).to.equal(e);
        });
      });

    });

    describe('#isDeleteComponentDisabled', function() {

      var tests = ['INSTALLED', 'UNKNOWN', 'INSTALL_FAILED', 'UPGRADE_FAILED', 'INIT'];
      var testE = false;
      var defaultE = true;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isDeleteComponentDisabled')).to.equal(e);
        });
      });

    });

    describe('#componentTextStatus', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: null,
          e: 'status',
          m: 'get content status'
        },
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: Em.Object.create({componentTextStatus: 'new_status'}),
          e: 'new_status',
          m: 'get hostComponent status'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          hostComponentView = App.HostComponentView.create({
            startBlinking: function(){},
            doBlinking: function(){},
            getDesiredAdminState: function(){return $.ajax({});},
            content: test.content,
            hostComponent: test.hostComponent
          });
          expect(hostComponentView.get('componentTextStatus')).to.equal(test.e);
        });
      });

    });

    describe('#workStatus', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({workStatus: 'status'}),
          hostComponent: null,
          e: 'status',
          m: 'get content workStatus'
        },
        {
          content: Em.Object.create({workStatus: 'status'}),
          hostComponent: Em.Object.create({workStatus: 'new_status'}),
          e: 'new_status',
          m: 'get hostComponent workStatus'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          hostComponentView = App.HostComponentView.create({
            startBlinking: function(){},
            doBlinking: function(){},
            getDesiredAdminState: function(){return $.ajax({});},
            content: test.content,
            hostComponent: test.hostComponent
          });
          expect(hostComponentView.get('workStatus')).to.equal(test.e);
        });
      });

    });

    describe('#statusClass', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({workStatus: App.HostComponentStatus.install_failed,passiveState: 'OFF'}),
          e: 'health-status-color-red icon-cog'
        },
        {
          content: Em.Object.create({workStatus: App.HostComponentStatus.installing, passiveState: 'OFF'}),
          e: 'health-status-color-blue icon-cog'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'ON'}),
          e: 'health-status-started'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'IMPLIED'}),
          e: 'health-status-started'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'OFF'}),
          e: 'health-status-started'
        }
      ]);

      tests.forEach(function(test) {
        it(test.content.get('workStatus') + ' ' + test.content.get('passiveState'), function() {
          hostComponentView = App.HostComponentView.create({
            startBlinking: function(){},
            doBlinking: function(){},
            getDesiredAdminState: function(){return $.ajax({});},
            content: test.content
          });
          expect(hostComponentView.get('statusClass')).to.equal(test.e);
        });
      });

    });

    describe('#isInProgress', function() {

      var tests = ['STOPPING', 'STARTING'];
      var testE = true;
      var defaultE = false;

      App.HostComponentStatus.getStatusesList().forEach(function(status) {
        it(status, function() {
          hostComponentView.set('content', {workStatus: status});
          var e = tests.contains(status) ? testE : defaultE;
          expect(hostComponentView.get('isInProgress')).to.equal(e);
        });
      });

    });

  });
  
});
window.require.register("test/views/main/host/details/host_component_views/decommissionable_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/host_component');
  require('views/main/host/details/host_component_view');
  require('mixins');
  require('mixins/main/host/details/host_components/decommissionable');

  var hostComponentView;

  describe('App.Decommissionable', function() {

    beforeEach(function() {
      hostComponentView = App.HostComponentView.create(App.Decommissionable, {
        startBlinking: function(){},
        doBlinking: function(){},
        getDesiredAdminState: function(){return $.ajax({});}
      });
    });

    describe('#componentTextStatus', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: null,
          isComponentRecommissionAvailable: false,
          isComponentDecommissioning: false,
          e: 'status',
          m: 'get content status'
        },
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: Em.Object.create({componentTextStatus: 'new_status'}),
          isComponentRecommissionAvailable: false,
          isComponentDecommissioning: false,
          e: 'new_status',
          m: 'get hostComponent status'
        },
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: Em.Object.create({componentTextStatus: 'new_status'}),
          isComponentRecommissionAvailable: false,
          isComponentDecommissioning: false,
          e: 'new_status',
          m: 'get hostComponent status'
        },
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: Em.Object.create({componentTextStatus: 'new_status'}),
          isComponentRecommissionAvailable: true,
          isComponentDecommissioning: true,
          e: Em.I18n.t('hosts.host.decommissioning'),
          m: 'get decommissioning status'
        },
        {
          content: Em.Object.create({componentTextStatus: 'status'}),
          hostComponent: Em.Object.create({componentTextStatus: 'new_status'}),
          isComponentRecommissionAvailable: true,
          isComponentDecommissioning: false,
          e: Em.I18n.t('hosts.host.decommissioned'),
          m: 'get decommissioned status'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          hostComponentView = App.HostComponentView.create(App.Decommissionable, {
            startBlinking: function(){},
            doBlinking: function(){},
            getDesiredAdminState: function(){return $.ajax({});},
            content: test.content,
            hostComponent: test.hostComponent,
            isComponentRecommissionAvailable: test.isComponentRecommissionAvailable,
            isComponentDecommissioning: test.isComponentDecommissioning
          });
          expect(hostComponentView.get('componentTextStatus')).to.equal(test.e);
        });
      });

    });

    describe('#statusClass', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({workStatus: App.HostComponentStatus.install_failed,passiveState: 'OFF'}),
          isComponentRecommissionAvailable: false,
          e: 'health-status-color-red icon-cog'
        },
        {
          content: Em.Object.create({workStatus: App.HostComponentStatus.installing, passiveState: 'OFF'}),
          isComponentRecommissionAvailable: false,
          e: 'health-status-color-blue icon-cog'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'ON'}),
          isComponentRecommissionAvailable: false,
          e: 'health-status-started'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'IMPLIED'}),
          isComponentRecommissionAvailable: false,
          e: 'health-status-started'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'OFF'}),
          isComponentRecommissionAvailable: false,
          e: 'health-status-started'
        },
        {
          content: Em.Object.create({workStatus: 'STARTED', passiveState: 'OFF'}),
          isComponentRecommissionAvailable: true,
          e: 'health-status-DEAD-ORANGE'
        },
        {
          content: Em.Object.create({workStatus: 'STARTING', passiveState: 'OFF'}),
          isComponentRecommissionAvailable: true,
          e: 'health-status-DEAD-ORANGE'
        },
        {
          content: Em.Object.create({workStatus: 'INSTALLED', passiveState: 'OFF'}),
          isComponentRecommissionAvailable: true,
          e: 'health-status-DEAD-ORANGE'
        }

      ]);

      tests.forEach(function(test) {
        it(test.content.get('workStatus') + ' ' + test.content.get('passiveState') + ' ' + test.isComponentRecommissionAvailable?'true':'false', function() {
          hostComponentView = App.HostComponentView.create(App.Decommissionable,{
            startBlinking: function(){},
            doBlinking: function(){},
            getDesiredAdminState: function(){return $.ajax({});},
            isComponentRecommissionAvailable: test.isComponentRecommissionAvailable,
            content: test.content
          });
          expect(hostComponentView.get('statusClass')).to.equal(test.e);
        });
      });

    });

    describe('#isInProgress', function() {

      var tests = Em.A([
        {
          workStatus: App.HostComponentStatus.stopping,
          isDecommissioning: false,
          e: true
        },
        {
          workStatus: App.HostComponentStatus.starting,
          isDecommissioning: false,
          e: true
        },
        {
          workStatus: 'other_status',
          isDecommissioning: false,
          e: false
        },
        {
          workStatus: 'other_status',
          isDecommissioning: true,
          e: true
        }
      ]);

      tests.forEach(function(test) {
        it(test.workStatus + ' ' + test.isDecommissioning?'true':'false', function() {

          hostComponentView = App.HostComponentView.create(App.Decommissionable,{
            startBlinking: function(){},
            doBlinking: function(){},
            getDesiredAdminState: function(){return $.ajax({});},
            isDecommissioning: test.isDecommissioning,
            content: Em.Object.create({workStatus: test.workStatus})
          });

          expect(hostComponentView.get('isInProgress')).to.equal(test.e);
        });
      });

    });

  });
  
});
window.require.register("test/views/main/host/summary_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('models/host');
  require('models/service');
  require('models/host_component');
  require('mappers/server_data_mapper');
  require('views/main/host/summary');

  var mainHostSummaryView;
  var extendedMainHostSummaryView = App.MainHostSummaryView.extend({content: {}, addToolTip: function(){}, installedServices: []});

  describe('App.MainHostSummaryView', function() {

    beforeEach(function() {
      mainHostSummaryView = extendedMainHostSummaryView.create({});
    });

    describe('#sortedComponents', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'B'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of masters, slaves and clients',
          e: ['A', 'C', 'B']
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'B'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of masters and slaves',
          e: ['A', 'C', 'D', 'B']
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'B'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of masters',
          e: ['B', 'A', 'C', 'D']
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'B'}),
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'A'}),
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'C'}),
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'D'})
            ])
          }),
          m: 'List of slaves',
          e: ['B', 'A', 'C', 'D']
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([])
          }),
          m: 'Empty list',
          e: []
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'B'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of clients',
          e: []
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          test.content.get('hostComponents').forEach(function(component) {
            component.set('id', component.get('componentName'));
          });
          mainHostSummaryView.set('sortedComponents', []);
          mainHostSummaryView.set('content', test.content);
          mainHostSummaryView.sortedComponentsFormatter();
          expect(mainHostSummaryView.get('sortedComponents').mapProperty('componentName')).to.eql(test.e);
        });
      });

    });

    describe('#clients', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'B'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of masters, slaves and clients',
          e: ['D']
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'B'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of masters and slaves',
          e: []
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'B'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: true, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of masters',
          e: []
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'B'}),
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'A'}),
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'C'}),
              Em.Object.create({isMaster: false, isSlave: true, componentName: 'D'})
            ])
          }),
          m: 'List of slaves',
          e: []
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([])
          }),
          m: 'Empty list',
          e: []
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'B'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'A'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'C'}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D'})
            ])
          }),
          m: 'List of clients',
          e: ['B', 'A', 'C', 'D']
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          mainHostSummaryView.set('content', test.content);
          expect(mainHostSummaryView.get('clients').mapProperty('componentName')).to.eql(test.e);
        });
      });

    });

    describe('#areClientWithStaleConfigs', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D', staleConfigs: true}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'C', staleConfigs: false})
            ])
          }),
          m: 'Some clients with stale configs',
          e: true
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D', staleConfigs: false}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'C', staleConfigs: false})
            ])
          }),
          m: 'No clients with stale configs',
          e: false
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'D', staleConfigs: true}),
              Em.Object.create({isMaster: false, isSlave: false, componentName: 'C', staleConfigs: true})
            ])
          }),
          m: 'All clients with stale configs',
          e: true
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([])
          }),
          m: 'Empty list',
          e: false
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          mainHostSummaryView.set('content', test.content);
          expect(mainHostSummaryView.get('areClientWithStaleConfigs')).to.equal(test.e);
        });
      });

    });

    describe('#isAddComponent', function() {

      var tests = Em.A([
        {content: {healthClass: 'health-status-DEAD-YELLOW', hostComponents: Em.A([])}, e: false},
        {content: {healthClass: 'OTHER_VALUE', hostComponents: Em.A([])}, e: true}
      ]);

      tests.forEach(function(test) {
        it(test.content.healthClass, function() {
          mainHostSummaryView.set('content', test.content);
          expect(mainHostSummaryView.get('isAddComponent')).to.equal(test.e);
        });
      });

    });

    describe('#installableClientComponents', function() {

      it('delete host not supported', function() {
        App.set('supports.deleteHost', false);
        expect(mainHostSummaryView.get('installableClientComponents')).to.eql([]);
        App.set('supports.deleteHost', true);
      });

      var tests = Em.A([
        {
          content: Em.Object.create({
            hostComponents: Em.A([])
          }),
          services: ['HDFS', 'YARN', 'MAPREDUCE2'],
          e: ['HDFS_CLIENT', 'YARN_CLIENT', 'MAPREDUCE2_CLIENT'],
          m: 'no one client installed'
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({
                componentName: 'HDFS_CLIENT'
              })
            ])
          }),
          services: ['HDFS', 'YARN', 'MAPREDUCE2'],
          e: ['YARN_CLIENT', 'MAPREDUCE2_CLIENT'],
          m: 'some clients are already installed'
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({
                componentName: 'HDFS_CLIENT'
              }),
              Em.Object.create({
                componentName: 'YARN_CLIENT'
              }),
              Em.Object.create({
                componentName: 'MAPREDUCE2_CLIENT'
              })
            ])
          }),
          services: ['HDFS', 'YARN', 'MAPREDUCE2'],
          e: [],
          m: 'all clients are already installed'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          mainHostSummaryView.set('content', test.content);
          mainHostSummaryView.set('installedServices', test.services);
          expect(mainHostSummaryView.get('installableClientComponents')).to.include.members(test.e);
          expect(test.e).to.include.members(mainHostSummaryView.get('installableClientComponents'));
        });
      });

    });

    describe('#addableComponents', function() {

      var tests = Em.A([
        {
          content: Em.Object.create({
            hostComponents: Em.A([])
          }),
          services: ['HDFS', 'YARN', 'MAPREDUCE2'],
          e: ['DATANODE', 'NODEMANAGER', 'CLIENTS'],
          m: 'no components on host (impossible IRL, but should be tested)'
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({
                componentName: 'HDFS_CLIENT'
              }),
              Em.Object.create({
                componentName: 'DATANODE'
              })
            ])
          }),
          services: ['HDFS', 'YARN', 'MAPREDUCE2'],
          e: ['NODEMANAGER', 'CLIENTS'],
          m: 'some components are already installed'
        },
        {
          content: Em.Object.create({
            hostComponents: Em.A([
              Em.Object.create({
                componentName: 'HDFS_CLIENT'
              }),
              Em.Object.create({
                componentName: 'YARN_CLIENT'
              }),
              Em.Object.create({
                componentName: 'MAPREDUCE2_CLIENT'
              }),
              Em.Object.create({
                componentName: 'NODEMANAGER'
              })
            ])
          }),
          services: ['HDFS', 'YARN', 'MAPREDUCE2'],
          e: ['DATANODE'],
          m: 'all clients and some other components are already installed'
        }
      ]);

      tests.forEach(function(test) {
        it(test.m, function() {
          mainHostSummaryView.set('content', test.content);
          mainHostSummaryView.set('installedServices', test.services);
          expect(mainHostSummaryView.get('addableComponents').mapProperty('componentName')).to.include.members(test.e);
          expect(test.e).to.include.members(mainHostSummaryView.get('addableComponents').mapProperty('componentName'));
        });
      });

    });



  });
  
});
window.require.register("test/views/main/jobs/hive_job_details_tez_dag_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/main/jobs/hive_job_details_tez_dag_view');

  describe('App.MainHiveJobDetailsTezDagView', function() {
    var tezDagView = App.MainHiveJobDetailsTezDagView.create();

    describe('#getNodeCalculatedDimensions()', function() {
      var tests = [
        {
          i: {
            node: {
              operations: [],
              duration: 100
            },
            minDuration: 1
          },
          e: {
            width : 1800,
            height : 400,
            drawWidth : 180,
            drawHeight : 40,
            scale : 10
          },
          m: 'Node(ops=0,duration=100) minDuration=1'
        },
        {
          i: {
            node: {
              operations: [1,2,3,4,5],
              duration: 4
            },
            minDuration: 1
          },
          e: {
            width : 360,
            height : 160,
            drawWidth : 180,
            drawHeight : 40+40,
            scale : 2
          },
          m: 'Node(ops=5,duration=4) minDuration=1'
        },
        {
          i: {
            node: {
              operations: [1],
              duration: 1
            },
            minDuration: 1
          },
          e: {
            width : 180,
            height : 60,
            drawWidth : 180,
            drawHeight : 60,
            scale : 1
          },
          m: 'Node(ops=1,duration=1) minDuration=1'
        },
        { // Error case
          i: {
            node: {
              operations: [1],
              duration: 1
            },
            minDuration: 3
          },
          e: {
            width : 180,
            height : 60,
            drawWidth : 180,
            drawHeight : 60,
            scale : 1
          },
          m: 'Node(ops=1,duration=1) minDuration=3'
        }
      ];
      tests.forEach(function(test) {
        it(test.m, function() {
          var nodeDim = tezDagView.getNodeCalculatedDimensions(test.i.node, test.i.minDuration);
          for(var key in test.e) {
            expect(nodeDim[key]).to.equal(test.e[key]);
          }
        });
      });
    });

  });
  
});
window.require.register("test/views/main/jobs/hive_job_details_tez_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one or more
   * contributor license agreements. See the NOTICE file distributed with this
   * work for additional information regarding copyright ownership. The ASF
   * licenses this file to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   * http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
   * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
   * License for the specific language governing permissions and limitations under
   * the License.
   */

  var App = require('app');
  module.exports = {
    _createVertex : function(row, col, state, type, numOps, inEdges, outEdges, vertexJsons) {
      var v = {
        id : 'v_' + row + '_' + col,
        instance_id : 'vi_' + row + '_' + col,
        name : 'Vertex ' + row + ', ' + col,
        state : state,
        type : type,
        operations : [],
        outgoing_edges : outEdges,
        incoming_edges : inEdges
      };
      for ( var c = 0; c < numOps; c++) {
        v.operations.push("Op " + c);
      }
      vertexJsons.push(v);
      return v;
    },

    _createEdge : function(id, type, from, to, edgeJsons) {
      var e = {
        id : id,
        instance_id : 'i_' + id,
        from_vertex_id : from.id,
        to_vertex_id : to.id,
        edge_type : type
      }
      edgeJsons.push(e);
      return e;
    },

    /**
     * Creates a Tez DAG for test purposes with 6 nodes in row 1, 1 node in row 2
     * and 5 nodes in row 3.
     *
     * Usage: <code>
     *     var testDag = jobUtils.createTezDag_6x1x5();
     *     vertices = testDag.get('vertices');
     *     edges = testDag.get('edges');
     * </code>
     */
    createTezDag_6x1x5 : function() {
      var vertices = [];
      var dagJson = {
        id : 'dag1',
        instance_id : 'dag1',
        name : 'Test DAG 1',
        stage : 'My stage',
        vertices : [],
        edges : []
      };
      var vertexJsons = [];
      var edgeJsons = [];
      // Row 1
      var v1 = this._createVertex(1, 1, "FAILED", App.TezDagVertexType.MAP, 30, [], [ 'e1' ], vertexJsons);
      var v2 = this._createVertex(1, 2, "RUNNING", App.TezDagVertexType.REDUCE, 2, [], [ 'e2' ], vertexJsons);
      var v3 = this._createVertex(1, 3, "FAILED", App.TezDagVertexType.MAP, 5, [], [ 'e3' ], vertexJsons);
      var v4 = this._createVertex(1, 4, "FAILED", App.TezDagVertexType.REDUCE, 10, [], [ 'e4' ], vertexJsons);
      var v5 = this._createVertex(1, 5, "FAILED", App.TezDagVertexType.MAP, 15, [], [ 'e5' ], vertexJsons);
      var v6 = this._createVertex(1, 6, "FAILED", App.TezDagVertexType.REDUCE, 20, [], [ 'e6' ], vertexJsons);
      // Row 2
      var v7 = this._createVertex(2, 1, "SUCCEEDED", App.TezDagVertexType.UNION, 30, [ 'e1', 'e2', 'e3', 'e4', 'e5', 'e6' ], [ 'e7', 'e8', 'e9', 'e10', 'e11' ], vertexJsons);
      // Row 3
      var v8 = this._createVertex(3, 1, "FAILED", App.TezDagVertexType.REDUCE, 30, [ 'e7' ], [], vertexJsons);
      var v9 = this._createVertex(3, 2, "RUNNING", App.TezDagVertexType.MAP, 2, [ 'e8' ], [], vertexJsons);
      var v10 = this._createVertex(3, 3, "FAILED", App.TezDagVertexType.REDUCE, 5, [ 'e9' ], [], vertexJsons);
      var v11 = this._createVertex(3, 4, "FAILED", App.TezDagVertexType.MAP, 10, [ 'e10' ], [], vertexJsons);
      var v12 = this._createVertex(3, 5, "FAILED", App.TezDagVertexType.REDUCE, 15, [ 'e11' ], [], vertexJsons);
      // Edges 1-2
      this._createEdge('e1', 'BROADCAST', v1, v7, edgeJsons);
      this._createEdge('e2', 'BROADCAST', v2, v7, edgeJsons);
      this._createEdge('e3', 'BROADCAST', v3, v7, edgeJsons);
      this._createEdge('e4', 'SCATTER_GATHER', v4, v7, edgeJsons);
      this._createEdge('e5', 'SCATTER_GATHER', v5, v7, edgeJsons);
      this._createEdge('e6', 'SCATTER_GATHER', v6, v7, edgeJsons);
      // Edges 2-3
      this._createEdge('e7', 'SCATTER_GATHER', v7, v8, edgeJsons);
      this._createEdge('e8', 'SCATTER_GATHER', v7, v9, edgeJsons);
      this._createEdge('e9', 'SCATTER_GATHER', v7, v10, edgeJsons);
      this._createEdge('e10', 'BROADCAST', v7, v11, edgeJsons);
      this._createEdge('e11', 'BROADCAST', v7, v12, edgeJsons);
      vertexJsons.forEach(function(v) {
        dagJson.vertices.push(v.id);
      })
      edgeJsons.forEach(function(e) {
        dagJson.edges.push(e.id);
      })
      App.store.load(App.TezDag, dagJson);
      App.store.loadMany(App.TezDagVertex, vertexJsons);
      App.store.loadMany(App.TezDagEdge, edgeJsons);
      return App.TezDag.find('dag1');
    },

    /**
     * Creates a Tez DAG for test purposes with 6 nodes in row 1, 1 node in row 2
     * and 5 nodes in row 3.
     *
     * Usage: <code>
     *     var testDag = jobUtils.createTezDag_7x1_1x1();
     *     vertices = testDag.get('vertices');
     *     edges = testDag.get('edges');
     * </code>
     */
    createTezDag_7x1_1x1 : function() {
      var vertices = [];
      var dagJson = {
        id : 'dag1',
        instance_id : 'dag1',
        name : 'Test DAG 1',
        stage : 'My stage',
        vertices : [],
        edges : []
      };
      var vertexJsons = [];
      var edgeJsons = [];
      // Row 1
      var v1 = this._createVertex(1, 1, "FAILED", App.TezDagVertexType.REDUCE, 30, [], [ 'e1' ], vertexJsons);
      var v4 = this._createVertex(1, 4, "FAILED", App.TezDagVertexType.MAP, 10, [], [ 'e4' ], vertexJsons);
      var v6 = this._createVertex(1, 6, "FAILED", App.TezDagVertexType.REDUCE, 20, [], [ 'e6' ], vertexJsons);
      var v2 = this._createVertex(1, 2, "RUNNING", App.TezDagVertexType.MAP, 2, [], [ 'e2' ], vertexJsons);
      var v3 = this._createVertex(1, 3, "FAILED", App.TezDagVertexType.REDUCE, 5, [], [ 'e3' ], vertexJsons);
      var v5 = this._createVertex(1, 5, "FAILED", App.TezDagVertexType.MAP, 15, [], [ 'e5' ], vertexJsons);
      var v7 = this._createVertex(1, 7, "FAILED", App.TezDagVertexType.REDUCE, 4, [], [ 'e7' ], vertexJsons);
      // Row 2
      var v8 = this._createVertex(2, 1, "SUCCEEDED", App.TezDagVertexType.MAP, 30, [ 'e1', 'e2', 'e3', 'e4' ], [ 'e8' ], vertexJsons);
      var v9 = this._createVertex(2, 2, "FAILED", App.TezDagVertexType.REDUCE, 30, [ 'e5', 'e6', 'e7' ], ['e9'], vertexJsons);
      // Row 3
      var v10 = this._createVertex(3, 1, "RUNNING", App.TezDagVertexType.UNION, 2, [ 'e8', 'e9' ], [], vertexJsons);
      // Edges 1-2
      this._createEdge('e1', 'BROADCAST', v1, v8, edgeJsons);
      this._createEdge('e2', 'BROADCAST', v2, v8, edgeJsons);
      this._createEdge('e3', 'BROADCAST', v3, v8, edgeJsons);
      this._createEdge('e4', 'SCATTER_GATHER', v4, v8, edgeJsons);
      this._createEdge('e5', 'SCATTER_GATHER', v5, v9, edgeJsons);
      this._createEdge('e6', 'SCATTER_GATHER', v6, v9, edgeJsons);
      this._createEdge('e7', 'SCATTER_GATHER', v7, v9, edgeJsons);
      // Edges 2-3
      this._createEdge('e8', 'SCATTER_GATHER', v8, v10, edgeJsons);
      this._createEdge('e9', 'SCATTER_GATHER', v9, v10, edgeJsons);
      vertexJsons.forEach(function(v) {
        dagJson.vertices.push(v.id);
      })
      edgeJsons.forEach(function(e) {
        dagJson.edges.push(e.id);
      })
      App.store.load(App.TezDag, dagJson);
      App.store.loadMany(App.TezDagVertex, vertexJsons);
      App.store.loadMany(App.TezDagEdge, edgeJsons);
      return App.TezDag.find('dag1');
    },

    /**
     * Creates a Tez DAG for test purposes. Each row in the graph is fully
     * connected to the next row. The number of nodes in each row is passed as
     * input.
     *
     * Usage:
     * <code>
     *  var testDag = jobUtils._test_createTezDag_fullyConnected([10,3,8]);
     *  vertices = testDag.get('vertices');
     *  edges = testDag.get('edges');
     * </code>
     */
    createTezDag_fullyConnected : function(rowCounts) {
      var vertices = [];
      var dagJson = {
        id : 'dag1',
        instance_id : 'dag1',
        name : 'Test DAG 1',
        stage : 'My stage',
        vertices : [],
        edges : []
      };
      var vertexJsons = [];
      var edgeJsons = [];
      var matrix = new Array(rowCounts.length);
      for ( var r = 0; r < rowCounts.length; r++) {
        matrix[r] = new Array(rowCounts[r]);
        for ( var c = 0; c < rowCounts[r]; c++) {
          var outs = [];
          var ins = [];
          if (r < rowCounts.length - 1) {
            for ( var c2 = 0; c2 < rowCounts[r + 1]; c2++) {
              outs.push('e_' + r + c + '_' + (r + 1) + c2);
            }
          }
          if (r > 0) {
            for ( var c2 = 0; c2 < rowCounts[r - 1]; c2++) {
              ins.push('e_' + (r - 1) + c2 + '_' + r + c);
            }
          }
          matrix[r][c] = this._createVertex(r, c, "RUNNING", true, (r + 1) * (c + 1), ins, outs, vertexJsons);
          if (r > 0) {
            for ( var c2 = 0; c2 < rowCounts[r - 1]; c2++) {
              this._createEdge('e_' + (r - 1) + c2 + '_' + r + c, 'BROADCAST', matrix[r - 1][c2], matrix[r][c], edgeJsons);
            }
          }
        }
      }
      vertexJsons.forEach(function(v) {
        dagJson.vertices.push(v.id);
      })
      edgeJsons.forEach(function(e) {
        dagJson.edges.push(e.id);
      })
      App.store.load(App.TezDag, dagJson);
      App.store.loadMany(App.TezDagVertex, vertexJsons);
      App.store.loadMany(App.TezDagEdge, edgeJsons);
      return App.TezDag.find('dag1');
    }
  }
  
});
window.require.register("test/views/main/service/info/config_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */


  var App = require('app');
  require('views/main/service/info/configs');

  describe('App.MainServiceInfoConfigsView', function() {

    var view = App.MainServiceInfoConfigsView.create({
      controller: Em.Object.create()
    });

    describe('#updateComponentInformation', function() {

      var testCases = [
        {
          title: 'if components absent then counters should be 0',
          content: {
            restartRequiredHostsAndComponents: {}
          },
          result: {
            componentsCount: 0,
            hostsCount: 0
          }
        },
        {
          title: 'if host doesn\'t have components then hostsCount should be 1 and componentsCount should be 0',
          content: {
            restartRequiredHostsAndComponents: {
              host1: []
            }
          },
          result: {
            componentsCount: 0,
            hostsCount: 1
          }
        },
        {
          title: 'if host has 1 component then hostsCount should be 1 and componentsCount should be 1',
          content: {
            restartRequiredHostsAndComponents: {
              host1: [{}]
            }
          },
          result: {
            componentsCount: 1,
            hostsCount: 1
          }
        }
      ];
      testCases.forEach(function(test) {
        it(test.title, function() {
          view.set('controller.content', test.content);
          view.updateComponentInformation();
          expect(view.get('componentsCount')).to.equal(test.result.componentsCount);
          expect(view.get('hostsCount')).to.equal(test.result.hostsCount);
        });
      });
    });
  });
  
});
window.require.register("test/views/wizard/step1_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/wizard/step1_view');

  describe('App.WizardStep1View', function () {
    var view = App.WizardStep1View.create({
      stacks: [],
      updateByCheckbox: function () {
      },
      editGroupLocalRepository: function () {
      },
      controller: Em.Object.create(),
      allRepoUnchecked: false
    });

    describe('#emptyRepoExist', function () {
      it('none repos', function () {
        view.set('allRepositoriesGroup', []);
        expect(view.get('emptyRepoExist')).to.equal(false);
      });
      it('one not empty repo', function () {
        view.set('allRepositoriesGroup', [
          {
            'empty-error': false
          }
        ]);
        expect(view.get('emptyRepoExist')).to.equal(false);
      });
      it('one empty repo', function () {
        view.set('allRepositoriesGroup', [
          {
            'empty-error': true
          }
        ]);
        expect(view.get('emptyRepoExist')).to.equal(true);
      });
    });

    describe('#invalidUrlExist', function () {
      var invalidUrlExistTestCases = [
        {
          title: 'if invalid count more than 0 and validation failed then invalid URL should exist',
          stacks: [
            Em.Object.create({
              isSelected: true,
              invalidCnt: 1
            })
          ],
          allRepositoriesGroup: [
            {
              'validation': 'icon-exclamation-sign'
            }
          ],
          result: true
        },
        {
          title: 'if invalid count equal 0 and validation failed then invalid URL shouldn\'t exist',
          stacks: [
            Em.Object.create({
              isSelected: true,
              invalidCnt: 0
            })
          ],
          allRepositoriesGroup: [
            {
              'validation': 'icon-exclamation-sign'
            }
          ],
          result: false
        },
        {
          title: 'if invalid count more than 0 and validation passed then invalid URL shouldn\'t exist',
          stacks: [
            Em.Object.create({
              isSelected: true,
              invalidCnt: 1
            })
          ],
          allRepositoriesGroup: [
            {
              'validation': 'icon-success'
            }
          ],
          result: false
        },
        {
          title: 'if invalid count equal 0 and validation passed then invalid URL shouldn\'t exist',
          stacks: [
            Em.Object.create({
              isSelected: true,
              invalidCnt: 0
            })
          ],
          allRepositoriesGroup: [
            {
              'validation': 'icon-success'
            }
          ],
          result: false
        }
      ];

      invalidUrlExistTestCases.forEach(function (test) {
        it(test.title, function () {
          view.get('controller').set('content', {stacks: test.stacks});
          view.set('allRepositoriesGroup', test.allRepositoriesGroup);
          expect(view.get('invalidUrlExist')).to.equal(test.result);
        });
      });
    });
    describe('#totalErrorCnt', function () {
      var totalErrorCntTestCases = [
        {
          title: 'if allRepoUnchecked is true then totalErrorCnt should be 1',
          allRepoUnchecked: true,
          allRepositoriesGroup: [
            {
              'empty-error': true,
              'validation': 'icon-exclamation-sign'
            }
          ],
          result: 1
        },
        {
          title: 'if validation passed successfully then totalErrorCnt should be 0',
          allRepoUnchecked: false,
          allRepositoriesGroup: [
            {
              'empty-error': false,
              'validation': 'icon-success'
            }
          ],
          result: 0
        },
        {
          title: 'if empty-error is true then totalErrorCnt should be 1',
          allRepoUnchecked: false,
          allRepositoriesGroup: [
            {
              'empty-error': true,
              'validation': 'icon-success'
            }
          ],
          result: 1
        },
        {
          title: 'if validation failed then totalErrorCnt should be 1',
          allRepoUnchecked: false,
          allRepositoriesGroup: [
            {
              'empty-error': false,
              'validation': 'icon-exclamation-sign'
            }
          ],
          result: 1
        },
        {
          title: 'if validation failed and empty-error is true then totalErrorCnt should be 2',
          allRepoUnchecked: false,
          allRepositoriesGroup: [
            {
              'empty-error': true,
              'validation': 'icon-exclamation-sign'
            }
          ],
          result: 2
        }
      ];

      totalErrorCntTestCases.forEach(function (test) {
        it(test.title, function () {
          view.set('allRepoUnchecked', test.allRepoUnchecked);
          view.set('allRepositoriesGroup', test.allRepositoriesGroup);
          expect(view.get('totalErrorCnt')).to.equal(test.result);
        });
      });
    });
  });
  
});
window.require.register("test/views/wizard/step3_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/wizard/step3_view');

  describe('App.WizardStep3View', function () {
    Em.run.next = function(callback){
      callback()
    };
    var view = App.WizardStep3View.create({
      monitorStatuses: function () {
      },
      content: [
        Em.Object.create({
          name: 'host1',
          bootStatus: 'PENDING',
          isChecked: false
        }),
        Em.Object.create({
          name: 'host2',
          bootStatus: 'PENDING',
          isChecked: true
        }),
        Em.Object.create({
          name: 'host3',
          bootStatus: 'PENDING',
          isChecked: true
        })
      ],
      pageContent: function () {
        return this.get('content');
      }.property('content')
    });

    describe('watchSelection', function () {
      it('2 of 3 hosts selected', function () {
        view.watchSelection();
        expect(view.get('noHostsSelected')).to.equal(false);
        expect(view.get('selectedHostsCount')).to.equal(2);
      });
      it('all hosts selected', function () {
        view.selectAll();
        view.watchSelection();
        expect(view.get('noHostsSelected')).to.equal(false);
        expect(view.get('selectedHostsCount')).to.equal(3);
      });
      it('none hosts selected', function () {
        view.unSelectAll();
        view.watchSelection();
        expect(view.get('noHostsSelected')).to.equal(true);
        expect(view.get('selectedHostsCount')).to.equal(0);
      });
    });


    describe('selectAll', function () {
      it('select all hosts', function () {
        view.selectAll();
        expect(view.get('content').everyProperty('isChecked', true)).to.equal(true);
      });
    });

    describe('unSelectAll', function () {
      it('unselect all hosts', function () {
        view.unSelectAll();
        expect(view.get('content').everyProperty('isChecked', false)).to.equal(true);
      });
    });

    var testCases = [
      {
        title: 'none hosts',
        content: [],
        result: {
          "ALL": 0,
          "RUNNING": 0,
          "REGISTERING": 0,
          "REGISTERED": 0,
          "FAILED": 0
        }
      },
      {
        title: 'all hosts RUNNING',
        content: [
          Em.Object.create({
            name: 'host1',
            bootStatus: 'RUNNING'
          }),
          Em.Object.create({
            name: 'host2',
            bootStatus: 'RUNNING'
          }),
          Em.Object.create({
            name: 'host3',
            bootStatus: 'RUNNING'
          })
        ],
        result: {
          "ALL": 3,
          "RUNNING": 3,
          "REGISTERING": 0,
          "REGISTERED": 0,
          "FAILED": 0
        }
      },
      {
        title: 'all hosts REGISTERING',
        content: [
          Em.Object.create({
            name: 'host1',
            bootStatus: 'REGISTERING'
          }),
          Em.Object.create({
            name: 'host2',
            bootStatus: 'REGISTERING'
          }),
          Em.Object.create({
            name: 'host3',
            bootStatus: 'REGISTERING'
          })
        ],
        result: {
          "ALL": 3,
          "RUNNING": 0,
          "REGISTERING": 3,
          "REGISTERED": 0,
          "FAILED": 0
        }
      },
      {
        title: 'all hosts REGISTERED',
        content: [
          Em.Object.create({
            name: 'host1',
            bootStatus: 'REGISTERED'
          }),
          Em.Object.create({
            name: 'host2',
            bootStatus: 'REGISTERED'
          }),
          Em.Object.create({
            name: 'host3',
            bootStatus: 'REGISTERED'
          })
        ],
        result: {
          "ALL": 3,
          "RUNNING": 0,
          "REGISTERING": 0,
          "REGISTERED": 3,
          "FAILED": 0
        }
      },
      {
        title: 'all hosts FAILED',
        content: [
          Em.Object.create({
            name: 'host1',
            bootStatus: 'FAILED'
          }),
          Em.Object.create({
            name: 'host2',
            bootStatus: 'FAILED'
          }),
          Em.Object.create({
            name: 'host3',
            bootStatus: 'FAILED'
          })
        ],
        result: {
          "ALL": 3,
          "RUNNING": 0,
          "REGISTERING": 0,
          "REGISTERED": 0,
          "FAILED": 3
        }
      },
      {
        title: 'first host is FAILED, second is RUNNING, third is REGISTERED',
        content: [
          Em.Object.create({
            name: 'host1',
            bootStatus: 'FAILED'
          }),
          Em.Object.create({
            name: 'host2',
            bootStatus: 'RUNNING'
          }),
          Em.Object.create({
            name: 'host3',
            bootStatus: 'REGISTERED'
          })
        ],
        result: {
          "ALL": 3,
          "RUNNING": 1,
          "REGISTERING": 0,
          "REGISTERED": 1,
          "FAILED": 1
        }
      },
      {
        title: 'two hosts is REGISTERING, one is REGISTERED',
        content: [
          Em.Object.create({
            name: 'host1',
            bootStatus: 'REGISTERING'
          }),
          Em.Object.create({
            name: 'host2',
            bootStatus: 'REGISTERING'
          }),
          Em.Object.create({
            name: 'host3',
            bootStatus: 'REGISTERED'
          })
        ],
        result: {
          "ALL": 3,
          "RUNNING": 0,
          "REGISTERING": 2,
          "REGISTERED": 1,
          "FAILED": 0
        }
      }
    ];

    describe('countCategoryHosts', function () {
      testCases.forEach(function (test) {
        it(test.title, function () {
          view.set('content', test.content);
          view.countCategoryHosts();
          view.get('categories').forEach(function (category) {
            expect(category.get('hostsCount')).to.equal(test.result[category.get('hostsBootStatus')])
          })
        });
      }, this);
    });

    describe('filter', function () {
      testCases.forEach(function (test) {
        describe(test.title, function () {
          view.get('categories').forEach(function (category) {
            it('. Selected category - ' + category.get('hostsBootStatus'), function () {
              view.set('content', test.content);
              view.selectCategory({context: category});
              view.filter();
              expect(view.get('filteredContent').length).to.equal(test.result[category.get('hostsBootStatus')])
            });
          })
        });
      }, this);
    });

  });
  
});
window.require.register("test/views/wizard/step9_view_test", function(exports, require, module) {
  /**
   * Licensed to the Apache Software Foundation (ASF) under one
   * or more contributor license agreements.  See the NOTICE file
   * distributed with this work for additional information
   * regarding copyright ownership.  The ASF licenses this file
   * to you under the Apache License, Version 2.0 (the
   * "License"); you may not use this file except in compliance
   * with the License.  You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */

  var App = require('app');
  require('views/wizard/step9_view');


  describe('App.WizardStep9View', function () {
    var view = App.WizardStep9View.create({
      onStatus: function () {},
      content: [],
      pageContent: function () {
        return this.get('content');
      }.property('content')
    });
    var testCases = [
      {
        title: 'none hosts',
        content: [],
        result: {
          "all": 0,
          "inProgress": 0,
          "warning": 0,
          "success": 0,
          "failed": 0
        }
      },
      {
        title: 'all hosts inProgress',
        content: [
          Em.Object.create({
            name: 'host1',
            status: 'in_progress'
          }),
          Em.Object.create({
            name: 'host2',
            status: 'info'
          }),
          Em.Object.create({
            name: 'host3',
            status: 'pending'
          })
        ],
        result: {
          "all": 3,
          "inProgress": 3,
          "warning": 0,
          "success": 0,
          "failed": 0
        }
      },
      {
        title: 'all hosts warning',
        content: [
          Em.Object.create({
            name: 'host1',
            status: 'warning'
          }),
          Em.Object.create({
            name: 'host2',
            status: 'warning'
          }),
          Em.Object.create({
            name: 'host3',
            status: 'warning'
          })
        ],
        result: {
          "all": 3,
          "inProgress": 0,
          "warning": 3,
          "success": 0,
          "failed": 0
        }
      },
      {
        title: 'all hosts success',
        content: [
          Em.Object.create({
            name: 'host1',
            status: 'success'
          }),
          Em.Object.create({
            name: 'host2',
            status: 'success'
          }),
          Em.Object.create({
            name: 'host3',
            status: 'success'
          })
        ],
        result: {
          "all": 3,
          "inProgress": 0,
          "warning": 0,
          "success": 3,
          "failed": 0
        }
      },
      {
        title: 'all hosts failed',
        content: [
          Em.Object.create({
            name: 'host1',
            status: 'failed'
          }),
          Em.Object.create({
            name: 'host2',
            status: 'failed'
          }),
          Em.Object.create({
            name: 'host3',
            status: 'heartbeat_lost'
          })
        ],
        result: {
          "all": 3,
          "inProgress": 0,
          "warning": 0,
          "success": 0,
          "failed": 3
        }
      },
      {
        title: 'first host is failed, second is warning, third is success',
        content: [
          Em.Object.create({
            name: 'host1',
            status: 'failed'
          }),
          Em.Object.create({
            name: 'host2',
            status: 'success'
          }),
          Em.Object.create({
            name: 'host3',
            status: 'warning'
          })
        ],
        result: {
          "all": 3,
          "inProgress": 0,
          "warning": 1,
          "success": 1,
          "failed": 1
        }
      },
      {
        title: 'two hosts is inProgress, one is success',
        content: [
          Em.Object.create({
            name: 'host1',
            status: 'pending'
          }),
          Em.Object.create({
            name: 'host2',
            status: 'in_progress'
          }),
          Em.Object.create({
            name: 'host3',
            status: 'success'
          })
        ],
        result: {
          "all": 3,
          "inProgress": 2,
          "warning": 0,
          "success": 1,
          "failed": 0
        }
      }
    ];

    describe('countCategoryHosts', function () {
      testCases.forEach(function (test) {
        it(test.title, function () {
          view.set('content', test.content);
          view.countCategoryHosts();
          view.get('categories').forEach(function (category) {
            expect(category.get('hostsCount')).to.equal(test.result[category.get('hostStatus')])
          })
        });
      }, this);
    });

    describe('filter', function () {
      testCases.forEach(function (test) {
        describe(test.title, function () {
          view.get('categories').forEach(function (category) {
            it('. Selected category - ' + category.get('hostStatus'), function () {
              view.set('content', test.content);
              view.selectCategory({context: category});
              view.filter();
              expect(view.get('filteredContent').length).to.equal(test.result[category.get('hostStatus')])
            });
          })
        });
      }, this);
    });
  });

  describe('App.HostStatusView', function () {
    var tests = [
      {
        p: 'isFailed',
        tests: [
          {
            obj: {
              status: 'failed',
              progress: 100
            },
            e: true
          },
          {
            obj: {
              status: 'failed',
              progress: 99
            },
            e: false
          },
          {
            obj: {
              status: 'success',
              progress: 100
            },
            e: false
          },
          {
            obj: {
              status: 'success',
              progress: 99
            },
            e: false
          }
        ]
      },
      {
        p: 'isSuccess',
        tests: [
          {
            obj: {
              status: 'success',
              progress: 100
            },
            e: true
          },
          {
            obj: {
              status: 'success',
              progress: 99
            },
            e: false
          },
          {
            obj: {
              status: 'failed',
              progress: 100
            },
            e: false
          },
          {
            obj: {
              status: 'failed',
              progress: 99
            },
            e: false
          }
        ]
      },
      {
        p: 'isWarning',
        tests: [
          {
            obj: {
              status: 'warning',
              progress: 100
            },
            e: true
          },
          {
            obj: {
              status: 'warning',
              progress: 99
            },
            e: false
          },
          {
            obj: {
              status: 'failed',
              progress: 100
            },
            e: false
          },
          {
            obj: {
              status: 'failed',
              progress: 99
            },
            e: false
          }
        ]
      }
    ];
    tests.forEach(function(test) {
      describe(test.p, function() {
        test.tests.forEach(function(t) {
          var hostStatusView = App.HostStatusView.create();
          it('obj.progress = ' + t.obj.progress + '; obj.status = ' + t.obj.status, function() {
            hostStatusView.set('obj', t.obj);
            expect(hostStatusView.get(test.p)).to.equal(t.e);
          });
        });
      });
    });
  });
  
});
