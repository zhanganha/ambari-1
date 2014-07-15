/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


var App = require('app');

App.UploadLicenseView = Em.View.extend({

  templateName: require('templates/main/license/upload'),

  isFileApi: function () {
    return (window.File && window.FileReader && window.FileList) ? true : false ;
  }.property(),

  didInsertElement: function () {
	    //TODO: move it to separate function in Ember.View using reopenClass
	    $("[rel=popover]").popover({'placement': 'right', 'trigger': 'hover'});

	    //todo: move them to conroller
	    this.set('controller.hostsError',null);
	    this.set('controller.sshKeyError',null);
	  },
  
});

App.LicenseFileUploader = Ember.View.extend({
	  //TODO: rewrite it using tagName and attribute binding
	  //TODO: rewrite it as independent component and place it somewhere in utils
	  // alternative is to move it to App.WizardStep2View  <form method="post" enctype="multipart/form-data" id="licenseForm">
	  template:Ember.Handlebars.compile('<input type="file"  id="uploadLicense" {{bindAttr disabled="view.disabled"}} />'),
	  classNames: ['ssh-key-input-indentation'],

	  change: function (e) {
	    var self=this;
	    if (e.target.files && e.target.files.length == 1) {
	      var file = e.target.files[0];
	      var reader = new FileReader();
	      reader.onload = (function(theFile) {
	        return function(e) {
	          $('#sshKey').html(e.target.result);
	          $("#uploadError").html("");
	        };
	      })(file);
//	      reader.readAsText(file);
	      reader.readAsBinaryString(file);
	    }
	  }
	});

//TODO: move it to App.WizardStep2View
App.WizardTextField = Ember.TextField.extend({
  disabled: function(){
    return !this.get('controller.content.installOptions.isJavaHome');
  }.property('controller.content.installOptions.isJavaHome'),
  click: function(){
    return false;
  }
});
