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

App.MainChartsHeatmapView = Em.View.extend({
  templateName: require('templates/main/charts/heatmap'),
  spinner: null,
  didInsertElement: function () {
    this._super();
    // set default metric
    this.set('controller.selectedMetric', this.get('controller.allMetrics')[0].get('items')[0]);
    this.get('controller.racks').setEach('isLoaded', false);
    $("#heatmapDetailsBlock").hide();
  },
  showLoading: function () {
    if (this.get('controller.selectedMetric.loading') || !this.get('controller.racks').everyProperty('isLoaded')) {
      var e = document.getElementById("heatmap-metric-loading");
      if (e) {
        $(e).children('div.spinner').remove();
        var spinOpts = {
          lines: 9,
          length: 4,
          width: 2,
          radius: 3,
          top: '0',
          left: '0'
        };
        this.set('spinner', new Spinner(spinOpts).spin(e));
      }
    } else {
      var spinner = this.get('spinner');
      if (spinner) {
        spinner.stop();
      }
      this.set('spinner', null);
    }
  }.observes('controller.selectedMetric.loading', 'controller.racks.@each.isLoaded')
});