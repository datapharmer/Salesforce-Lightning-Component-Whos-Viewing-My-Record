({
    doInit: function (component, event, helper) {
        var action = component.get("c.getSessionId");
        action.setCallback(this, function (response) {
            // Check if component is still valid before proceeding
            if (component.isValid() && response.getState() === "SUCCESS") {
                // Configure CometD for this component
                var sessionId = response.getReturnValue();
                var cometd = new window.org.cometd.CometD();
                cometd.configure({
                    url: window.location.protocol + "//" + window.location.hostname + "/cometd/41.0/",
                    requestHeaders: { Authorization: "OAuth " + sessionId },
                    appendMessageTypeToURL: false,
                });
                cometd.websocketEnabled = false;
                component.set("v.cometd", cometd);

                cometd.handshake(
                    $A.getCallback(function (status) {
                        // Double check validity inside the handshake callback
                        if (component.isValid()) {
                            if (status.successful) {
                                var eventName = component.get("v.channel");
                                var subscription = cometd.subscribe(
                                    eventName,
                                    $A.getCallback(function (message) {
                                        if (component.isValid()) {
                                            var messageEvent = component.getEvent("onMessage");
                                            if (messageEvent != null) {
                                                messageEvent.setParams({
                                                    "type": "message",
                                                    "payload": message.data.payload
                                                });
                                                messageEvent.fire();
                                            }
                                        }
                                    })
                                );
                                component.set("v.subscription", subscription);
                                // Notify parent that subscription is ready
                                var readyEvent = component.getEvent("onMessage");
                                if (readyEvent != null) {
                                    readyEvent.setParams({
                                        "type": "status",
                                        "payload": { status: "Subscribed" }
                                    });
                                    readyEvent.fire();
                                }
                            } else {
                                console.error("streaming component: " + JSON.stringify(status));
                                helper.displayToast(
                                    component,
                                    "error",
                                    "Failed to subscribe to Event Channel"
                                );
                            }
                        }
                    })
                );
            }
        });
        $A.enqueueAction(action);
    },

    handleDestroy: function (component, event, helper) {
        // Retrieve the references immediately
        var cometd = component.get("v.cometd");
        var subscription = component.get("v.subscription");

        // Disconnect immediately without waiting for callbacks to interact with the component
        if (cometd) {
            try {
                if (subscription) {
                    // Unsubscribe without a callback or with a safe, detached callback
                    cometd.unsubscribe(subscription);
                }
                // Disconnect immediately
                cometd.disconnect();
            } catch (e) {
                console.error('Error during cleanup: ' + e);
            }
        }
    }
})
