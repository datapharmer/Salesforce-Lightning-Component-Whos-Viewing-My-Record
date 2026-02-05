({
    // Lifecycle hook: runs when the component is initialized
    onInit : function(component, event, helper) {
        // Do not fire event here. Wait for streaming channel to be ready.
        var rId = component.get("v.recordId");
        component.set('v.priorRecordId', rId);
    },

    // Handler for when the recordId attribute changes
    recordChange : function(component, event, helper) {
        component.set('v.whosViewing',[]);
        var prId = component.get('v.priorRecordId');
        
        // Only push events if we are sure the subscription is active
        helper.pushEvent(component, prId, "Left", "" );
        
        var rId = component.get('v.recordId');
        helper.pushEvent(component, rId, "New", "" );
        
        component.set('v.priorRecordId', rId);
    },

    // Handler for receiving platform events (Streaming API)
    handleMessage : function(component, event, helper) {
        var eventType = event.getParam("type");
        var payload = event.getParam("payload");
        
        // Handle subscription ready status
        if (eventType === "status" && payload.status === "Subscribed") {
            var rId = component.get("v.recordId");
            // Now that we are subscribed, announce presence
            helper.pushEvent(component, rId, "New", "" );
            return;
        }

        // Proceed only if it's a message
        if (eventType !== "message") return;

        var recId = component.get("v.recordId");
        var payloadRecId = payload.recordId__c;
        var payloadStatus = payload.status__c;
        var payloadUserId = payload.userId__c;
        var payloadRT = payload.responseTo__c;
        var uId = $A.get("$SObjectType.CurrentUser.Id");
        var viewing = component.get("v.whosViewing");

        if (payloadStatus=="New" && recId == payloadRecId && payloadUserId != uId){
            // Check for duplicates before adding
            var isViewing = helper.isUserViewing(component,payloadUserId);
            if (isViewing==false){
                viewing.push(payload);
                component.set("v.whosViewing",viewing);
            };
            //respond to the new user
            helper.pushEvent(component, recId, "Response", payloadUserId );
        
        } else if (payloadStatus=="Response" && recId == payloadRecId && payloadRT == uId){
            // FIX: Add duplicate check here for Responses as well
            var isViewing = helper.isUserViewing(component, payloadUserId);
            if (isViewing == false) {
                viewing.push(payload);
                component.set("v.whosViewing",viewing);  
            }
            
        } else if (payloadStatus=="Left" && recId == payloadRecId && payloadUserId != uId){
            var isViewing = helper.isUserViewing(component,payloadUserId);
            if (isViewing==true){
                var leftViewing=[];
                var i;
                for (i = 0; i < viewing.length; i++){
                    if(viewing[i].userId__c != payloadUserId){
                        leftViewing.push(viewing[i]);
                    };
                };
                component.set("v.whosViewing",leftViewing);
            };
        };
    },

    // Handler for lightning:recordData change event
    recordUpdated: function(component, event, helper) {
        console.log('Lightning Data, record change detected.');
        var changeType = event.getParams().changeType;
        if (changeType === "ERROR") {
            helper.displayToast(component, 'error', 'Notifications: Error Connecting to Record.');
        } else if (changeType === "LOADED") {
            helper.displayToast(component, 'warning', 'Notifications: Record Loaded by another user.');
        } else if (changeType === "REMOVED") {
            helper.displayToast(component, 'error', 'Notifications: This record have been deleted by another user.');
        } else if (changeType === "CHANGED") {
            helper.displayToast(component, 'error', 'Notifications: This record have been edited by another user.');
        }
    },

    // Handler for muting/unmuting notifications
    onToggleMute : function(component, event, helper) {
        var isMuted = component.get('v.isMuted');
        component.set('v.isMuted', !isMuted);
        helper.displayToast(component, 'success', 'Notifications '+ ((!isMuted) ? 'muted' : 'unmuted') +'.');
    },

    // Handler for updating the utility bar label and highlight
    utlityNotifications: function (component, event) {
        var userLabel = component.get('v.label');
        if (!userLabel) {
            userLabel = "Who's Viewing";
        }
        var viewing = component.get("v.whosViewing").length;
        if(viewing==0){
            var utilityAPI = component.find('utilitybar');
            utilityAPI.setUtilityHighlighted({ highlighted : false });
            utilityAPI.setUtilityLabel({ label : userLabel });
            component.set('v.readNotification', true);
        } else {
            var utilityAPI = component.find('utilitybar');
            utilityAPI.setUtilityHighlighted({ highlighted : true });
            utilityAPI.setUtilityLabel({ label : userLabel + ' (' + viewing + ')' });
            component.set('v.readNotification', false);
        }
    }
})
