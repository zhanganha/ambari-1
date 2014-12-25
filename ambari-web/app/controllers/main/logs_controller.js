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

App.MainLogsController = Em.Controller.extend({
/*
 * https://github.com/emberjs/ember.js/issues/1221 prevents this controller
 * from being an Ember.ArrayController. Doing so will keep the UI flashing
 * whenever any of the 'sortProperties' or 'sortAscending' properties are set.
 * 
 *  To bypass this issue this controller will be a regular controller. Also,
 *  for memory-leak issues and sorting purposes, we are decoupling the backend
 *  model and the UI model. There will be simple Ember POJOs for the UI which
 *  will be periodically updated from backend Logs model. 
 */
  
  name:'mainLogsController',

  /**
   * Unsorted ArrayProxy
   */
  content: App.Log.find(),
  
  /**
   * Sorted ArrayProxy
   */
  sortedContent: [],

  navIDs: {
    backIDs: [],
    nextID: ''
  },
  
  loadTimeout: null,

  updateLogsByClick: function () {
    this.set('navIDs.backIDs', []);
    this.set('navIDs.nextID', '');
    this.get('filterObject').set('nextFromId', '');
    this.get('filterObject').set('backFromId', '');
    this.get('filterObject').set('fromTs', '');
    this.set('hasNewLogs', false);
    this.set('resetPagination', true);
    this.loadLogs();
  },

  totalOfLogs: 0,
  setTotalOfLogs: function () {
    if(this.get('totalOfLogs') < this.get('content.length')){
      this.set('totalOfLogs', this.get('content.length'));
    }
  }.observes('content.length'),

  columnsName: Ember.ArrayController.create({
    content: [
      { name: Em.I18n.t('logs.column.id'), index: 0 },
      { name: Em.I18n.t('logs.column.time'), index: 1 },
      { name: Em.I18n.t('logs.column.devel'), index: 2 },
      { name: Em.I18n.t('logs.column.cont'), index: 3 }
    ]
  }),

  lastIDSuccessCallback: function(data, jqXHR, textStatus) {
    var lastReceivedID = data.entities[0].entity;
    if(this.get('lastLogID') == '') {
      this.set('lastLogID', lastReceivedID);
    } else if (this.get('lastLogID') !== lastReceivedID) {
      this.set('lastLogID', lastReceivedID);
      if(!App.Log.find().findProperty('id', lastReceivedID)) {
        this.set('hasNewLogs', true);
      }
    }
  },

  lastIDErrorCallback: function(data, jqXHR, textStatus) {
    console.debug(jqXHR);
  },

  loadLogs : function() {
  	
  },

  initializePagination: function() {
    var back_link_IDs = this.get('navIDs.backIDs.[]');
    if(!back_link_IDs.contains(this.get('lastLogID'))) {
      back_link_IDs.push(this.get('lastLogID'));
    }
    this.set('filterObject.backFromId', this.get('lastLogID'));
    this.get('filterObject').set('fromTs', App.dateTime());
  },

  navigateNext: function() {
    this.set("filterObject.backFromId", '');
    var back_link_IDs = this.get('navIDs.backIDs.[]');
    var lastBackID = this.get('navIDs.nextID');
    if(!back_link_IDs.contains(lastBackID)) {
      back_link_IDs.push(lastBackID);
    }
    this.set('navIDs.backIDs.[]', back_link_IDs);
    this.set("filterObject.nextFromId", this.get('navIDs.nextID'));
    this.set('navIDs.nextID', '');
    this.loadLogs();
  },

  navigateBack: function() {
    this.set("filterObject.nextFromId", '');
    var back_link_IDs = this.get('navIDs.backIDs.[]');
    back_link_IDs.pop();
    var lastBackID = back_link_IDs[back_link_IDs.length - 1]
    this.set('navIDs.backIDs.[]', back_link_IDs);
    this.set("filterObject.backFromId", lastBackID);
    this.loadLogs();
  }
  
})
