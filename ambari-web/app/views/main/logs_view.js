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
var sort = require('views/common/sort_view');

App.MainLogsView = App.TableView.extend({
  templateName: require('templates/main/logs'),

  content: [],


  /**
   * If no logs table rows to show.
   */
  noDataToShow:true,

  filterCondition:[],

  /*
   If no logs to display set noDataToShow to true, else set emptyData to false.
   */
  noDataToShowObserver: function () {
    if(this.get("controller.content.length") > 0){
      this.set("noDataToShow",false);
    }else{
      this.set("noDataToShow",true);
    }
  }.observes("controller.content.length"),

  willInsertElement: function () {
    var self = this;
    var name = this.get('controller.name');
    var colPropAssoc = this.get('colPropAssoc');
    var filterConditions = App.db.getFilterConditions(name);
    if (filterConditions) {
      this.set('filterConditions', filterConditions);
      var childViews = this.get('childViews');

      filterConditions.forEach(function(condition) {
        var view = childViews.findProperty('column', condition.iColumn);
        if (view) {
          //self.get('controller.filterObject').set(colPropAssoc[condition.iColumn], condition.value);
          view.set('value', condition.value);
          if(view.get('setPropertyOnApply')){
            view.setValueOnApply();
          }
          Em.run.next(function() {
            view.showClearFilter();
          });
        }
      });
    } else {
      this.clearFilters();
    }
    this.onApplyIdFilter();
    this.set('tableFilteringComplete', true);
  },

  didInsertElement: function () {
    if(!this.get('controller.sortingColumn')){
      var columns = this.get('childViews')[0].get('childViews')
      if(columns && columns.findProperty('name', 'startTime')){
        columns.findProperty('name','startTime').set('status', 'sorting_desc');
        this.get('controller').set('sortingColumn', columns.findProperty('name','startTime'))
      }
    }
  },

  pageContentObserver: function () {
    if (!this.get('controller.loading')) {
      if ($('.tooltip').length) {
        Ember.run.later(this, function() {
          if ($('.tooltip').length > 1) {
            $('.tooltip').first().remove();
          };
        }, 500);
      };
    };
  }.observes('controller.loading'),

  init: function() {
    this._super();
    App.tooltip($('body'), {
      selector: '[rel="tooltip"]',
      template: '<div class="tooltip jobs-tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
      placement: 'bottom'
    });
  },

  willDestroyElement : function() {
    $('.tooltip').remove();
  },


  /**
   * associations between content (logs list) property and column index
   */
  colPropAssoc: function () {
    var associations = [];
    associations[1] = 'time';
    associations[2] = 'devel';
    associations[3] = 'cont';
    return associations;
  }.property(),

  clearFilters: function() {
    this.get('childViews').forEach(function(childView) {
      if (childView['clearFilter']) {
        childView.clearFilter();
      }
    });
  },

  logFailMessage: function() {
    return Em.I18n.t('logs.table.log.fail');
  }.property(),

  logsPaginationLeft: Ember.View.extend({
    tagName: 'a',
    template: Ember.Handlebars.compile('<i class="icon-arrow-left"></i>'),
    classNameBindings: ['class'],
    class: function () {
      if (this.get("parentView.hasBackLinks") && !this.get('controller.filterObject.isAnyFilterApplied')) {
        return "paginate_previous";
      }
      return "paginate_disabled_previous";
    }.property('parentView.hasBackLinks', 'controller.filterObject.isAnyFilterApplied'),

    click: function () {
      if (this.get("parentView.hasBackLinks") && !this.get('controller.filterObject.isAnyFilterApplied')) {
        this.get('controller').navigateBack();
      }
    }
  }),

  logsPaginationRight: Ember.View.extend({
    tagName: 'a',
    template: Ember.Handlebars.compile('<i class="icon-arrow-right"></i>'),
    classNameBindings: ['class'],
    class: function () {
      if (this.get("parentView.hasNextLogs") && !this.get('controller.filterObject.isAnyFilterApplied')) {
        return "paginate_next";
      }
      return "paginate_disabled_next";
    }.property("parentView.hasNextLogs", 'controller.filterObject.isAnyFilterApplied'),

    click: function () {
      if (this.get("parentView.hasNextLogs") && !this.get('controller.filterObject.isAnyFilterApplied')) {
        this.get('controller').navigateNext();
      }
    }
  }),

  hasNextLogs: function() {
    return (this.get("controller.navIDs.nextID.length") > 0);
  }.property('controller.navIDs.nextID'),

  hasBackLinks: function() {
    return (this.get("controller.navIDs.backIDs").length > 1);
  }.property('controller.navIDs.backIDs.[].length')

})
