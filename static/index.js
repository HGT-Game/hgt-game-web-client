// 弹登录信息
function showLogin() {
    layer.open({
        title: "登录",
        type: 1,
        skin: 'layui-layer-demo', //样式类名
        closeBtn: 0, //不显示关闭按钮
        anim: 2,
        shadeClose: true, //开启遮罩关闭
        area: ['420px', '240px'],
        content: $("#login-div"),
        btn: ['确认'],
        yes: function (index, layero) {
            $.ajax({
                method: "post",
                url: API_DOMAIN + "/auth/login",
                dataType: "json",
                data: {
                    account: $("#account").val(),
                    password: $("#password").val()
                },
                success: function (res) {
                    console.log(res)
                    if (res._code != 0) {
                        layer.msg(res._message)
                    } else {
                        $("#login-div").hide()
                        layer.close(index)
                        // 确认登录
                        IS_LOGIN = true
                        $("#loginBtn").hide()
                        USER_ID = res._data.userInfo.userId
                        USERNAME = res._data.userInfo.username
                        gameServer(res._data.accessToken)

                    }
                },
                error: function (res) {
                    console.log(res)
                    layer.msg("出错了，请查看控制台并联系技术人员修复")
                }

            })
        }
    });
}

// 游戏服务
function gameServer(authorization) {
    var buffer;
    websocket = new WebSocket(WSS_DOMAIN + "?Authorization=" + authorization);
    websocket.binaryType = 'arraybuffer';
    websocket.onopen = function () {
        IS_WEBSOCKET = true
        console.log("websocket open");
        // 发送获取数据
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = 2012
                var childMessage = root.lookupType("SoupMessage.LoadReq");
                var childData = childMessage.fromObject({})
                messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
        document.getElementById("recv").innerHTML = "Connected";
    }
    websocket.inclose = function () {
        console.log('websocket close');
    }
    websocket.onmessage = function (e) {
        var baseMessage
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            const baseMessageDecode = root.lookupType("GameMessage.Message");
            var buf = new Uint8Array(e.data);
            baseMessage = baseMessageDecode.decode(buf)
            console.log(baseMessage)
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                switch (baseMessage.protocol) {
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
                        IS_CREATE_ROOME = true
                        IS_IN_ROOM = true
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
                        $.each(resMessage.room.seatsChange, function () {
                            $("#showRoomContent").append('<p>名字：' + this.avaName + ' <span style="color:red;">加入房间</span>, mc：' + this.mc + '</p>')
                        })
                        IS_IN_ROOM = true
                        MC_ID = resMessage.room.mcId
                        if(resMessage.room.mcId == USER_ID) {
                            IS_MC = true
                        }
                        if (resMessage.room.mcId == USER_ID && resMessage.room.status == 2) {
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
                        IS_IN_ROOM = false
                        layer.msg("离开房间")
                        break;
                    case -2005: // 准备返回
                        var resChildMessage = root.lookupType("SoupMessage.PrepareRes");
                        resMessage = resChildMessage.decode(baseMessage.data)
                        layer.msg("准备/取消操作完成")
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
                    case 2901: // 接收房间消息
                        var resChildMessage = root.lookupType("SoupMessage.RoomPush");
                        resMessage = resChildMessage.decode(baseMessage.data)
                        if (resMessage.status == 2) {
                            showQuestion(resMessage.selectQuestions)
                        }
                        break;
                    default:

                }
                console.log(resMessage)
            });
        });
    }
    document.getElementById("sendBtn").onclick = function () {
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = document.getElementById("protocol").value
                switch (protocol) {
                    case "3000": // 测试数据
                        var childMessage = root.lookupType("SoupMessage.CreateRoomReq");
                        var childData = childMessage.fromObject({ password: "passssss", name: "dddddddddddd", max: 8 })
                        break;
                }

                messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });

                console.log(messageCreate)
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
    }
}

// 创建房间
function createRoom() {
    if (IS_CREATE_ROOME) {
        layer.msg("请勿重复创建")
        return
    }
    if (!IS_WEBSOCKET) {
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
                    var childData = childMessage.fromObject({ password: roomPassword, name: roomName, max: roomMax })
                    messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
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
            var childData = childMessage.fromObject({ roomId: roomId, password: password })
            messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}
// 加入房间
function joinRoom() {
    if (!IS_WEBSOCKET) {
        layer.msg("请先登录")
        return
    }
    if (IS_IN_ROOM) {
        layer.msg("已经在房间，请勿重复")
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
// 离开房间
function leaveRoom() {
    if (!IS_WEBSOCKET) {
        layer.msg("请先登录")
        return
    }
    if (!IS_IN_ROOM) {
        layer.msg("不在房间，不用离开")
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
                messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
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
    if (!IS_WEBSOCKET) {
        layer.msg("请先登录")
        return
    }
    if (!IS_IN_ROOM) {
        layer.msg("不在房间，无效准备")
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
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2005
            var childMessage = root.lookupType("SoupMessage.PrepareReq");
            var childData = childMessage.fromObject({ ok: ok })
            messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}
// 发送内容
function sendMessage() {
    if (!IS_WEBSOCKET) {
        layer.msg("请先登录")
        return
    }
    if (!IS_IN_ROOM) {
        layer.msg("不在房间，无效准备")
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
                var childData = childMessage.fromObject({ content: content })
                messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
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
                $("#selectQuestionVal").hide()
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
            var childData = childMessage.fromObject({ id: id })
            messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}
// 呈现所有聊天内容
function appendAllMsg(msgs) {
    $.each(msgs, function () {
        $("#roundMsgContent").append('<p onclick="mcReply(' + "'" + this.id + "'" + ');">名字：' + this.avaName + ' , 内容：<span style="color:red;">' + this.content + '</span></p>')
    })
}
// mc回答
function mcReply(id) {
    if (!IS_MC) {
        return
    }
    layer.prompt({ title: '回答：1:未回答 2:不相关 3:是 4:否 5:半对', formType: 3 }, function (answer, index) {
        layer.close(index);
        console.log(id)
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err;
            var baseMessage = root.lookupType("GameMessage.Message");
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err;
                var protocol = 2009
                var childMessage = root.lookupType("SoupMessage.AnswerReq");
                var childData = childMessage.fromObject({ id: id, answer: answer })
                messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
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
        layer.msg('游戏结束');
    });
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2010
            var childMessage = root.lookupType("SoupMessage.EndReq");
            var childData = childMessage.fromObject({})
            messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
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
            messageCreate = baseMessage.fromObject({ protocol: protocol, code: 0, data: childMessage.encode(childData).finish() });
            console.log(messageCreate)
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}