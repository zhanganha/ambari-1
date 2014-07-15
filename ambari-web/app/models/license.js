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

App.LicenseModel = Em.Object.extend({
  id:0
});

App.License = DS.Model.extend({
  id:DS.attr('string'),
  version:DS.attr('string'),
  date1:DS.attr('string'),
  date2:DS.attr('string'),
  auditItems:DS.hasMany('App.ServiceAudit')
});

App.ViewLicenseForm = App.Form.extend({
	  className:App.License,
	  object:function () {
	    return App.router.get('mainLicenseDetailsController.content');
	  }.property('App.router.mainLicenseDetailsController.content'),

	  fieldsOptions:[
	    { name:"id", displayName:"Mac" },
	    { name:"version", displayName:"Version" },
	    { name:"date1", displayName:"CommencementDate"},
	    { name:"date2", displayName:"ExpiryDate"}
	  ],
	  fields:[],
	  disableUsername:function () {
		    this.getField("id").set("disabled", "disabled");
		  }.observes('object'),

		  isValid:function () {

		    var isValid = this._super();
		    thisForm = this;
		    return isValid;
		  },

		  save: function () {
		    var object = this.get('object');
		    var formValues = {};
		    $.each(this.get('fields'), function () {
		      formValues[this.get('name')] = this.get('value');
		    });

		    $.each(formValues, function (k, v) {
		      object.set(k, v);
		    });

		    //App.store.commit();
		    this.set('result', 1);

		    return true;
		  }
	});

App.License.FIXTURES = [];

