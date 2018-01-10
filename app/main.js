'use strict'
angular.module('app', ['amqp-091', 'smart-table', 'ui.bootstrap'])
    .controller('home', function ($rootScope, $scope, $http, amqpUtil, amqp) {
        var amqpConfig = {
            url: 'wss://sandbox.kaazing.net/amqp091',
            virtualHost: '/',
            credentials: {
                username: 'guest',
                password: 'guest'
            },
            exchange: 'amq.topic',
            queue: 'amqp-test',
            routingKey: 'person'
        };
        $scope.person = {
            message: 'Barkha', category: ''
        };
        $scope.assigned_tasks = 45;
        $scope.reminders = 4;
        $scope.notifications = 14;
        $scope.toggle = true;
        $scope.toggleCustom = function() {
            $scope.toggle = $scope.toggle === false? true: false;
            $scope.count = 0;
        };
        var date = new Date();
        $scope.count = 0;
        var weekday = new Array(7);
        weekday[0] =  "Sunday";
        weekday[1] = "Monday";
        weekday[2] = "Tuesday";
        weekday[3] = "Wednesday";
        weekday[4] = "Thursday";
        weekday[5] = "Friday";
        weekday[6] = "Saturday";
        var monthNames = [
            "Jan", "Feb", "Mar",
            "Apr", "May", "June", "July",
            "Aug", "Sept", "Oct",
            "Nov", "Dec"         
        ];
        var day = date.getDate();
        var monthIndex = date.getMonth();
        var year = date.getFullYear();
        var dayOfWeek = date.getDay();
        $scope.dateForFormat = Date.now();
        $scope.dateToDisplay = weekday[dayOfWeek]+' '+ monthNames[monthIndex]+' '+day+', '+year;
        console.log($scope.dateToDisplay);
        $scope.rowCollection = [
            {message: 'Oliver has assigned you an amazing interview', category: 'Assigned tasks', date: "Yesterday"},
            {message: 'Barkha  is great and she Rocks!', category: 'Notifications', date: "Yesterday"}
        ];
        $scope.rowCollection.forEach(function(entry) {
            
            console.log(entry);
        });
        $scope.displayedCollection = [].concat($scope.rowCollection);

        $scope.greeting = {};
        $scope.send = function () {
            $scope.$emit('person.send');
        };

        $scope.removeRow = function(index) {
            if($scope.displayedCollection[index].category == 'Assigned tasks') {
                $scope.assigned_tasks--;
            } else if($scope.displayedCollection[index].category == 'Reminders') {
                $scope.reminders--;
            } else {
                $scope.notifications--;
            }
            $scope.displayedCollection.splice(index, 1);

        }
        amqp.connect(amqpConfig).then(function () {

            var consumeChannel = amqp.client.openChannel(function (channel) {
                consumeChannel.addEventListener('declarequeue', function () {
                    console.log(amqpConfig.queue + ' declared');
                });
                consumeChannel.addEventListener('bindqueue', function () {
                    console.log('Bound to ' + amqpConfig.exchange);
                });
                consumeChannel.addEventListener('consume', function () {
                    console.log('Consuming');
                });
                consumeChannel.addEventListener('flow', function (e) {
                    console.log('Flow: ' + e);
                });
                consumeChannel.addEventListener('close', function () {
                    console.log('Channel closed');
                });
                consumeChannel.addEventListener('message', function (event) {
                    var body = amqpUtil.getBodyAsString(event);
                    $scope.rowCollection.unshift(angular.fromJson(body));
                    $scope.$applyAsync();
                    setTimeout(function () {
                        event.target.ackBasic({
                            deliveryTag: event.args.deliveryTag,
                            multiple: true
                        });
                    }, 0);
                });
                consumeChannel
                    .declareQueue({queue: amqpConfig.queue, durable: true})
                    .bindQueue({queue: amqpConfig.queue, exchange: amqpConfig.exchange, routingKey: amqpConfig.routingKey})
                    .consumeBasic({queue: amqpConfig.queue, noAck: false, consumerTag: "client" + Math.floor(Math.random() * 100000000)});
                console.log('Channel initialized!');
            });
            var publishChannel = amqp.client.openChannel(function (channel) {
                publishChannel.addEventListener("declareexchange", function () {
                    console.log("EXCHANGE DECLARED: " + amqpConfig.exchange);
                });
                publishChannel.addEventListener("error", function (e) {
                    console.log("CHANNEL ERROR: Publish Channel - " + e.message);
                });
                publishChannel.addEventListener("close", function () {
                    console.log("CHANNEL CLOSED: Publish Channel");
                });
                $scope.$on('person.send', function () {
                    console.log('Sending ' + angular.toJson($scope.person));
                    $scope.count++;
                    if($scope.person.category == 'Notifications') {
                        $scope.notifications++;
                        console.log($scope.notifications);
                    } else if($scope.person.category == 'Reminders') {
                        $scope.reminders++;
                        console.log($scope.reminders);
                    } else {
                        $scope.assigned_tasks++;
                        console.log($scope.assigned_tasks);
                    }
                    var body = amqpUtil.createMessageBody($scope.person);
                    var props = new Kaazing.AMQP.AmqpProperties();
                    publishChannel.publishBasic({body: body, properties: props, exchange: amqpConfig.exchange, routingKey: amqpConfig.routingKey});
                });
            });
            $scope.prettyDate = function (time){
                console.log(time);
                    var diff = (((new Date()).getTime() - time) / 1000),
                    day_diff = Math.floor(diff / 86400);
                        
                if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
                    return;
                        
                var res = day_diff == 0 && (
                        diff < 60 && "Just Now" ||
                        diff < 120 && "1 minute ago" ||
                        diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
                        diff < 7200 && "1 hour ago" ||
                        diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
                    day_diff == 1 && "Yesterday" ||
                    day_diff < 7 && day_diff + " days ago" ||
                    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
                    console.log(res);
                    $scope.person['date'] = res;

            }
            var unregister = $scope.$on('$routeChangeStart', function () {
                console.log('Route changed');
                consumeChannel.closeChannel({});
                publishChannel.closeChannel({});
                unregister();
            });
        }, function () {
        });
    });
