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

App.MainLicenseView = Em.View.extend({
  templateName: require('templates/main/license/index'),
//  licenses: licenseDetails(), 不用该方法
  didInsertElement: function(){
	  App.ajax.send({
  	      name: 'license.detail',
  	      sender: this,
  	      success: 'detailSuccess',
  	      error: 'detailError'
  	    });
  },
  detailSuccess:function(data){
	  var items = data['items'];
	  if(items !=null && items != undefined){
		  if(items.length > 0){
			  var entity = items[0].Licenses;
			  if("No License." == entity.id){
				  $("#addOperate").show();
				  $("#updateOperate").hide();
			  }else{
				  $("#addOperate").hide();
				  $("#updateOperate").show();
			  }
		  }else{
			  $("#addOperate").show();
			  $("#updateOperate").hide(); 
		  }
		  for(var i in  items){
			  var license = items[i].Licenses;
			  $("#licenseId").html(license.id);
			  $("#licenseVersion").html(license.version);
			  $("#licenseDate1").html(license.date1);
			  $("#licenseDate2").html(license.date2);
		  }
	  }else{
		  $("#addOperate").show();
		  $("#updateOperate").hide();
	  }
  },
  detailError:function(data){
	  App.showAlertPopup(Em.I18n.t('common.information'),Em.I18n.t('license.upload.detail'));
  }
  
});

