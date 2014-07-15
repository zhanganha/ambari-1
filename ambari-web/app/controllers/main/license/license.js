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

App.MainLicenseController = Em.Controller.extend({
  name:'mainLicenseController',
  
  addLicense:function (event) {
	  App.ModalPopup.show({
	      header:Em.I18n.t('license.add.header'),
	      body:Em.I18n.t('question.sure'),
	      primary:Em.I18n.t('yes'),
	      secondary:Em.I18n.t('no'),
	      onPrimary:function () {
	    	  this.hide();
	    	  router.transitionTo('admin.index');
	      },
	    });
  },
  updateLicense:function (event){
	  App.ModalPopup.show({
	      header:'更新许可证',
	      body:Em.I18n.t('question.sure'),
	      primary:Em.I18n.t('yes'),
	      secondary:Em.I18n.t('no'),
	      onPrimary:function () {
	    	  $.ajax({
     		     type: 'POST',
     		     url: App.apiPrefix + '/license/updateLicense',///data/licenses/upload.json
     		     dataType: 'json',
     		     success: function(data){
      	        	
     		     },
     		     error:function(){
//     		    	 App.showAlertPopup(Em.I18n.t('common.information'),Em.I18n.t('license.upload.failed')); 
     		     }
     		  });
     		this.hide();
     		router.transitionTo('adminLicense');
	      },
	    });
      },
      deleteLicense:function (event){
    	  App.ModalPopup.show({
    	      header:'删除许可证',
    	      body:Em.I18n.t('question.sure'),
    	      primary:Em.I18n.t('yes'),
    	      secondary:Em.I18n.t('no'),
    	      onPrimary:function () {
    	    	  $.ajax({
         		     type: 'POST',
         		     url: App.apiPrefix + '/license/deleteLicense',
         		     dataType: 'json',
         		     success: function(data){
          	        	
         		     },
         		     error:function(){
         		    	 
         		     }
         		  });
         		this.hide();
         		router.transitionTo('adminLicense');
    	      },
    	    });
        }
});

