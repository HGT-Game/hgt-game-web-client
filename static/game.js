function checkServer() {
    if(!sessionStorage.getItem("token")) {
        window.location = "#login"
        return false
    }
    // 判断weboskcet是否连接
    if(!WEBSOCKET_CONNECT) {
        window.location = "#login"
        return false
    }

    return true;
}

// 心跳检测
var heartCheck = {
    // timeout: 30000,//ms
    timeout: 2000,//ms
    timeoutObj: null,
    reset: function () {
        clearTimeout(this.timeoutObj);
        this.start();
    },
    start: function () {
        this.timeoutObj = setTimeout(function () {
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                var protocol = 2
                var childMessage = root.lookupType("GameMessage.HeartBeatReq");
                var childData = childMessage.fromObject({})
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        }, this.timeout)
    }
}

// 游戏服务
function gameServer(authorization, username, password) {
    var buffer;
    let url = WSS_DOMAIN;
    if (authorization !== "") {
        url = WSS_DOMAIN + "?Authorization=" + authorization
    }
    
    websocket = new WebSocket(url);
    websocket.binaryType = 'arraybuffer';
    websocket.onopen = function () {
        heartCheck.start();
        WEBSOCKET_CONNECT = true
        console.log("websocket open");
        if (authorization === "") {
            // 发送登录
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                var protocol = 1002
                var childMessage = root.lookupType("GameMessage.LoginReq");
                var childData = childMessage.fromObject({username: username, password: password})
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        } else {
            // 发送获取数据
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                protobuf.load("protos/SoupMessage.proto", function (err, root) {
                    if (err) throw err;
                    var protocol = 2012
                    var childMessage = root.lookupType("SoupMessage.LoadReq");
                    var childData = childMessage.fromObject({})
                    messageCreate = baseMessage.fromObject({
                        protocol: protocol,
                        code: 0,
                        data: childMessage.encode(childData).finish()
                    });
                    console.log(messageCreate)
                    buffer = baseMessage.encode(messageCreate).finish();
                    websocket.send(buffer);
                });
            });
        }
        console.log("weboskcet 登录成功")
    }
    websocket.error = function() {
        console.log('websocket 连接错误')
        WEBSOCKET_CONNECT = false
        // 清空sessionStorage
        sessionStorage.clear()
    }
    websocket.onclose = function () {
        console.log('websocket 断开');
        WEBSOCKET_CONNECT = false
        // 清空sessionStorage
        sessionStorage.clear()
    }
    websocket.onmessage = function (e) {
        heartCheck.reset();
        var baseMessage
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            const baseMessageDecode = root.lookupType("GameMessage.Message");
            var buf = new Uint8Array(e.data);
            baseMessage = baseMessageDecode.decode(buf)
            console.log(baseMessage)
            if (baseMessage.protocol == -1002) {
                var resChildMessage = root.lookupType("GameMessage.LoginRes");
                resMessage = resChildMessage.decode(baseMessage.data)
            } else if (baseMessage.protocol == -2) {
                console.log("心跳返回")
            } else {
                if (baseMessage.code != 200 && baseMessage.code != 20300) {
                    layer.msg(codeList[baseMessage.code])
                } else {
                    protobuf.load("protos/SoupMessage.proto", function (err, root) {
                        if (err) throw err;
                        switch (baseMessage.protocol) {
                            case -1002:
                                document.getElementById("recv").innerHTML = "已经登录";
                                break;
                            case -2001:
                                var resChildMessage = root.lookupType("SoupMessage.RoomHallRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $.each(resMessage.rooms, function () {
                                    let tr = "<tr><td>"+this.roomName+"</td><td>"+this.roomMax+"</td>"
                                    if(this.hasPassword) {
                                        tr += '<td style="text-align: right;"><a href="javascript:void(0)" class="button small" onclick="joinRoom('+this.hasPassword+', '+"'"+this.roomId+"'" + ')"><span class="icon solid fa-lock"></span>加入房间</a></td>'
                                    } else {
                                        tr += '<td style="text-align: right;"><a href="javascript:void(0)" class="button small" onclick="joinRoom('+this.hasPassword+', '+"'"+this.roomId+"'" + ')">加入房间</a></td>'
                                    }
                                    tr += '</tr>'
                                    $("#room-hall-content").append(tr)
                                })
                                window.location = "#room-hall"
                                break;
                            case -2002: // 创房返回
                                var resChildMessage = root.lookupType("SoupMessage.CreateRoomRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $('#room').css('display', "block");
                                $("#showRoomName").append("房间名")
                                $("#showRoomPassword").append("房间密码")
                                $("#showRoomMax").append("人数上限")
                                $("#showRoomId").append(resMessage.room.roomId)
                                $.each(resMessage.room.seatsChange, function () {
                                    $("#showRoomContent").append("<p>名字：" + this.avaName + ", mc：" + this.mc + "</p>")
                                })
                                IS_MC = true
                                layer.msg("成功创建房间")
                                console.log(resMessage.room)
                                break;
                            case -2003: // 加入房间返回
                                var resChildMessage = root.lookupType("SoupMessage.JoinRoomRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $('#room').css('display', "block");
                                $("#showRoomName").append("房间名")
                                $("#showRoomPassword").append("房间密码")
                                $("#showRoomMax").append("人数上限")
                                $("#showRoomId").append(resMessage.room.roomId)
                                addMember(resMessage.room.seatsChange)
                                MC_ID = resMessage.room.mcId
                                if (resMessage.room.mcId == sessionStorage.getItem("userId")) {
                                    IS_MC = true
                                }
                                if (resMessage.room.mcId == sessionStorage.getItem("userId") && resMessage.room.status == 2) {
                                    // 选题中
                                    layer.msg("选题中")
                                    showQuestion(resMessage.room.selectQuestions)
                                } else if (resMessage.room.status == 3) {
                                    // 对局开始
                                    layer.msg("游戏进行中")
                                    $("#round").css('display', "block")
                                    // @todo 呈现所有信息
                                    appendAllMsg(resMessage.room.msg)
                                } else {
                                    layer.msg("成功加入房间")
                                }
                                break;
                            case -2004: // 离开房间
                                var resChildMessage = root.lookupType("SoupMessage.LeaveRoomReq");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                IS_MC = false
                                $('#room').hide();
                                $("#showRoomName").html("房名：")
                                $("#showRoomPassword").html("密码：")
                                $("#showRoomMax").html("上限：")
                                $("#showRoomId").html("房号：")
                                $("#showRoomContent").empty()
                                layer.msg("离开房间")
                                break;
                            case -2005: // 准备返回
                                var resChildMessage = root.lookupType("SoupMessage.PrepareRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2008: // 聊天返回
                                var resChildMessage = root.lookupType("SoupMessage.ChatRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                layer.msg("发送成功")
                                break;
                            case -2009: // mc回复返回
                                var resChildMessage = root.lookupType("SoupMessage.AnswerRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2010: // 游戏结束返回
                                var resChildMessage = root.lookupType("SoupMessage.EndRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2011: // 选题返回
                                var resChildMessage = root.lookupType("SoupMessage.SelectQuestionRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2012: // 获取数据返回
                                var resChildMessage = root.lookupType("SoupMessage.LoadRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                if (resMessage.reconnect == true) {
                                    // 触发重连 直接请求加入房间
                                    joinRoomInternal(resMessage.roomId, resMessage.password)
                                }
                                break;
                            case -2901: // 接收房间消息
                                var resChildMessage = root.lookupType("SoupMessage.RoomPush");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                if (resMessage.status == 2 && IS_MC) {
                                    // 选题
                                    showQuestion(resMessage.selectQuestions)
                                } else if (resMessage.status == 3) {
                                    $("#select-question").hide()
                                    layer.closeAll()
                                    // 开始游戏
                                    $("#round").css('display', "block")
                                } else if (resMessage.status == 1) {
                                    // 房间准备中
                                    if (resMessage.question && resMessage.question.content) {
                                        layer.alert(resMessage.question.content, {
                                            title: '汤底',
                                            skin: 'layui-layer-lan',
                                            closeBtn: 0,
                                            anim: 4 //动画类型
                                        });
                                    }
                                    $("#roundQuesitonTitle").empty()
                                    $("#roundMsgContent").empty()
                                    $("#round").hide()
                                }
                                // 判断房间人员是否有变动
                                if (resMessage.seatsChange && resMessage.seatsChange.length > 0) {
                                    addMember(resMessage.seatsChange)
                                }

                                // 判断是否有人发送消息
                                if (resMessage.changedMsg && resMessage.changedMsg.length > 0) {
                                    appendAllMsg(resMessage.changedMsg)
                                }

                                break;
                            default:

                        }
                        console.log(resMessage)
                    });
                }
            }
        });
    }
}

// 获取大厅数据
function roomHall() {
    if(!checkServer()) {
        return
    }
    $("#room-hall-content").empty()
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2001
            var childMessage = root.lookupType("SoupMessage.RoomHallReq");
            var childData = childMessage.fromObject({})
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 创建房间
function createRoom() {
    if (!WEBSOCKET_CONNECT) {
        layer.msg("请先登录")
        return
    }
    layer.open({
        title: "创建房间",
        type: 1,
        skin: 'layui-layer-demo', //样式类名
        closeBtn: 0, //不显示关闭按钮
        anim: 2,
        shadeClose: true, //开启遮罩关闭
        area: ['420px', '240px'],
        content: $("#create-room"),
        btn: ['确认'],
        yes: function (index, layero) {
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                protobuf.load("protos/SoupMessage.proto", function (err, root) {
                    if (err) throw err;
                    var roomName = $("#roomName").val()
                    var roomMax = $("#roomMax").val()
                    var roomPassword = $("#roomPassword").val()
                    var protocol = 2002
                    var childMessage = root.lookupType("SoupMessage.CreateRoomReq");
                    var childData = childMessage.fromObject({password: roomPassword, name: roomName, max: roomMax})
                    messageCreate = baseMessage.fromObject({
                        protocol: protocol,
                        code: 0,
                        data: childMessage.encode(childData).finish()
                    });
                    console.log(messageCreate)
                    buffer = baseMessage.encode(messageCreate).finish();
                    websocket.send(buffer);
                    $("#create-room").hide()
                    layer.close(index)
                });
            });
        }
    });
}

// 加入房间
function joinRoomInternal(roomId, password) {
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2003
            var childMessage = root.lookupType("SoupMessage.JoinRoomReq");
            var childData = childMessage.fromObject({roomId: roomId, password: password})
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 加入房间
function joinRoom() {
    if (!WEBSOCKET_CONNECT) {
        layer.msg("请先登录")
        return
    }
    layer.open({
        title: "加入房间",
        type: 1,
        skin: 'layui-layer-demo', //样式类名
        closeBtn: 0, //不显示关闭按钮
        anim: 2,
        shadeClose: true, //开启遮罩关闭
        area: ['420px', '240px'],
        content: $("#join-room"),
        btn: ['确认'],
        yes: function (index, layero) {
            var roomId = $("#joinRoomId").val()
            var password = $("#joinRoomPassword").val()
            joinRoomInternal(roomId, password)
            layer.close(index)
        }
    });
}

// 添加成员
function addMember(members) {
    $.each(members, function () {
        $("#showRoomContent").append('<p>名字：' + this.avaName + ' <span style="color:red;">加入房间</span>, mc：' + this.mc + ',状态：' + (this.leave ? "离开" : "加入") + '</p>')
    })
    var showRoomContent = $("#showRoomContent")[0];
    showRoomContent.scrollTop = showRoomContent.scrollHeight;
}

// 离开房间
function leaveRoom() {
    if (!WEBSOCKET_CONNECT) {
        layer.msg("请先登录")
        return
    }
    layer.confirm('是否离开房间', {
        btn: ['是', '否'] //按钮
    }, function (index) {
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = 2004
                var childMessage = root.lookupType("SoupMessage.LeaveRoomReq");
                var childData = childMessage.fromObject({})
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
        layer.close(index)
    });
}

// 准备游戏
function prepare() {
    if (!WEBSOCKET_CONNECT) {
        layer.msg("请先登录")
        return
    }
    layer.confirm('是否准备/取消', {
        btn: ['准备', '取消'] //按钮
    }, function (index) {
        prepareInternal(true)
        layer.close(index)
    }, function () {
        prepareInternal(false)
    });
}

// 准备游戏内部
function prepareInternal(ok) {
    if (ok) {
        layer.msg("准备")
    } else {
        layer.msg("取消准备")
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2005
            var childMessage = root.lookupType("SoupMessage.PrepareReq");
            var childData = childMessage.fromObject({ok: ok})
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 发送内容
function sendMessage() {
    if (!WEBSOCKET_CONNECT) {
        layer.msg("请先登录")
        return
    }
    var content = $("#sendMessage").val()
    if (content == "") {
        layer.msg("发送内容不能为空")
    } else {
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = 2008
                var childMessage = root.lookupType("SoupMessage.ChatReq");
                var childData = childMessage.fromObject({content: content})
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
    }
}

// 呈现汤普
function showQuestion(questions) {
    // 选题中
    $.each(questions, function () {
        // if(this.)
        $("#selectQuestionVal").append('<option value="' + this.id + '">' + this.title + '</option>')
    })
    layer.open({
        title: "选汤普",
        type: 1,
        skin: 'layui-layer-demo', //样式类名
        closeBtn: 0, //不显示关闭按钮
        anim: 2,
        shadeClose: false, //开启遮罩关闭
        area: ['420px', '240px'],
        content: $("#select-question"),
        btn: ['确认'],
        yes: function (index, layero) {
            var id = $("#selectQuestionVal option:selected").val();
            if (id == "") {
                layer.msg("请正确选择")
            } else {
                $("#selectQuestionVal").empty()
                $("#select-question").hide()
                selectQuestion(id)
                layer.close(index)
            }
        }
    });
}

// 选择汤普
function selectQuestion(id) {
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2011
            var childMessage = root.lookupType("SoupMessage.SelectQuestionReq");
            var childData = childMessage.fromObject({id: id})
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 呈现所有聊天内容
function appendAllMsg(msgs) {
    $.each(msgs, function () {
        $("#roundMsgContent").append('<p onclick="mcReply(' + "'" + this.id + "'" + ');">名字：' + this.avaName + ' , 内容：<span style="color:red;">' + this.content + '</span>，回答：' + (this.answer ? this.answer : 0) + '</p>')
    })
    var roundMsgContent = $("#roundMsgContent")[0];
    roundMsgContent.scrollTop = roundMsgContent.scrollHeight;
}

// mc回答
function mcReply(id) {
    if (!IS_MC) {
        return
    }
    layer.prompt({title: '回答：1:未回答 2:不相关 3:是 4:否 5:半对', formType: 3}, function (answer, index) {
        layer.close(index);
        console.log(id)
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = 2009
                var childMessage = root.lookupType("SoupMessage.AnswerReq");
                var childData = childMessage.fromObject({id: id, answer: answer})
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
    });
}

// 游戏结束
function endGame() {
    if (!IS_MC) {
        return
    }
    layer.confirm('是否结束游戏', {
        btn: ['是', '否'] //按钮
    }, function () {
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = 2010
                var childMessage = root.lookupType("SoupMessage.EndReq");
                var childData = childMessage.fromObject({})
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
        layer.msg("游戏结束")
    });
}

function test() {
    layer.msg("查看控制台")
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 3000
            var childMessage = root.lookupType("SoupMessage.CreateRoomReq");
            var childData = childMessage.fromObject({})
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}