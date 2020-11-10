var codeList = []
// ---------- 创建房间相关
codeList[20001] = "房间不合法"
codeList[20002] = "房间人数设置不合法"
codeList[20003] = "CodeCreateRoomFailure"
codeList[20004] = "已经创建房间 退出即可"
// ---------- 房间相关
codeList[20101] = "房间不存在"
codeList[20102] = "当前房间不在游戏中"
codeList[20103] = "当前房间在游戏中"
codeList[20104] = "房间成员不存在"
codeList[20105] = "当前房间不在选题中"
// ---------- 加入房间相关
codeList[20200] = "加入房间失败"
codeList[20201] = "房间已经满人"
codeList[20202] = "已经加入房间"
// ---------- 房间推送相关
codeList[20300] = "收到房间推送"
// ---------- 离开房间相关
codeList[20400] = "离开房间失败"
codeList[20401] = "游戏中 不能离开房间"
// ---------- 准备相关
codeList[20500] = "准备失败"
codeList[20501] = "还有玩家没有准备"
codeList[20502] = "人数太少 最少三个人"
codeList[20503] = "游戏已经开始 不可以准备"
codeList[20504] = "你已经准备 请勿重复准备"
codeList[20505] = "你已经取消 请勿重复取消"
// ---------- 踢人相关
codeList[20600] = "踢人失败"
codeList[20601] = "踢人参数错误"
codeList[20602] = "此人不存在 无法踢人"
// ---------- 交换位置相关
codeList[20700] = "交换位置失败"
codeList[20701] = "当前座位已经有人"
// ---------- 结束游戏相关
codeList[20800] = "结束游戏失败"
codeList[20801] = "游戏不在游戏中不能结束"
// ---------- 聊天相关
codeList[20900] = "聊天被限制"
codeList[20901] = "聊天内容不合法"
codeList[20902] = "场次记录不存在"
codeList[20903] = "聊天记录不存在"
codeList[20904] = "说话太快了"
// ---------- 成员相关
codeList[21000] = "成员不是闲置状态"
codeList[21001] = "成员不是MC"
codeList[21002] = "成员不是房主"
// ----------- 回答相关
codeList[21100] = "答案类型不存在"
codeList[21101] = "不是mc 不具备权限"
// ----------- 题目相关
codeList[21200] = "题目不存在"
codeList[21201] = "不是mc 没有权限选题"


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
                        gameServer(res._data.accessToken, "", "")

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

// 注册
function register() {
    layer.msg("还未开放")
}

// java版本登录
function javaLogin() {
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
            var username = $("#account").val()
            var password = $("#password").val()
            gameServer("", username, password)
            layer.close(index)
        }
    })
}

// 心跳检测
var heartCheck = {
    timeout: 30000,//ms
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
        IS_WEBSOCKET = true
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
        document.getElementById("recv").innerHTML = "已经登录";
    }
    websocket.onclose = function () {
        console.log('websocket close');
        layer.msg("断开连接")
        document.getElementById("recv").innerHTML = "断开连接，请重新登录";
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
                USER_ID = resMessage.userId
                USERNAME = resMessage.username
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
                                addMember(resMessage.room.seatsChange)
                                IS_IN_ROOM = true
                                MC_ID = resMessage.room.mcId
                                if (resMessage.room.mcId == USER_ID) {
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
                                IS_MC = false
                                IS_CREATE_ROOME = false
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