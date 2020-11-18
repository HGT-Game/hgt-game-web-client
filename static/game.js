function checkServer() {
    if (!sessionStorage.getItem("token")) {
        window.location = "#tourist-login"
        return false
    }
    // 判断weboskcet是否连接
    if (!WEBSOCKET_CONNECT) {
        window.location = "#tourist-login"
        return false
    }

    return true;
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
        WEBSOCKET_CONNECT = true
        if (authorization === "") {
            // 发送登录
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                var protocol = 1002
                var childMessage = root.lookupType("GameMessage.LoginReq");
                var childData = childMessage.fromObject({ username: username, password: password })
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
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
                    buffer = baseMessage.encode(messageCreate).finish();
                    websocket.send(buffer);
                });
            });
        }
    }
    websocket.error = function () {
        console.log('连接错误')
        WEBSOCKET_CONNECT = false
        // 清空sessionStorage
        sessionStorage.clear()
    }
    websocket.onclose = function () {
        console.log('断开');
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
                                    let tr = "<tr><td>" + this.roomName + "</td><td>" + this.roomMax + "</td><td>" + this.roomId + "</td>"
                                    if (this.hasPassword) {
                                        tr += '<td style="text-align: right;"><a href="javascript:void(0)" class="button small" onclick="joinRoom(' + this.hasPassword + ', ' + "'" + this.roomId + "'" + ')"><span class="icon solid fa-lock"></span></a></td>'
                                    } else {
                                        tr += '<td style="text-align: right;"><a href="javascript:void(0)" class="button small" onclick="joinRoom(' + this.hasPassword + ', ' + "'" + this.roomId + "'" + ')">加入</a></td>'
                                    }
                                    tr += '</tr>'
                                    $("#room-hall-content").append(tr)
                                })
                                window.location = "#room-hall"
                                break;
                            case -2002: // 创房返回
                                var resChildMessage = root.lookupType("SoupMessage.CreateRoomRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                beforeRoomPrepare()
                                $("#room-prepare-name").append(resMessage.room.roomName)
                                $("#room-prepare-max").append(resMessage.room.roomMax)
                                $("#room-prepare-id").append(resMessage.room.roomId)
                                $.each(resMessage.room.seatsChange, function () {
                                    $("#room-prepare-member").append('<li id="room-prepare-' + this.aid + '"><span>MC&房主</span><a href="javascript:void(0)" class="icon solid fa-check-circle"></a>' + this.avaName + '</li>')
                                })
                                layer.msg("成功创建房间")
                                // 默认准备
                                IS_PREPARE = true
                                // 默认mc
                                IS_MC = true
                                // 默认房主
                                IS_OWNER = true
                                // 展现房间窗
                                roomPrepare()
                                break;
                            case -2003: // 加入房间返回
                                var resChildMessage = root.lookupType("SoupMessage.JoinRoomRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                beforeRoomPrepare()
                                $("#room-prepare-name").append(resMessage.room.roomName)
                                $("#room-prepare-max").append(resMessage.room.roomMax)
                                $("#room-prepare-id").append(resMessage.room.roomId)
                                addMember(resMessage.room.seatsChange)
                                if (resMessage.room.mcId == sessionStorage.getItem("userId") && resMessage.room.status == 2) {
                                    // 选题中
                                    layer.msg("选题中")
                                    showQuestion(resMessage.room.selectQuestions)
                                } else if (resMessage.room.status == 3) {
                                    // 对局开始
                                    start(resMessage.room)
                                    appendAllMsg(resMessage.room.msg)
                                } else {
                                    roomPrepare()
                                    layer.msg("成功加入房间")
                                }
                                break;
                            case -2004: // 离开房间
                                var resChildMessage = root.lookupType("SoupMessage.LeaveRoomReq");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                layer.closeAll()
                                // 是否准备
                                IS_PREPARE = false
                                // 是否mc
                                IS_MC = false
                                // 是否房主
                                IS_OWNER = false
                                layer.msg("离开房间")
                                window.location = "#"
                                break;
                            case -2005: // 准备返回
                                var resChildMessage = root.lookupType("SoupMessage.PrepareRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                IS_PREPARE = !IS_PREPARE
                                if (IS_PREPARE) {
                                    layer.msg("准备")
                                    $("#room-prepare-" + sessionStorage.getItem("userId")).find('a').removeClass("fa-times-circle")
                                    $("#room-prepare-" + sessionStorage.getItem("userId")).find('a').addClass("fa-check-circle")
                                } else {
                                    layer.msg("取消准备")
                                    $("#room-prepare-" + sessionStorage.getItem("userId")).find('a').addClass("fa-times-circle")
                                    $("#room-prepare-" + sessionStorage.getItem("userId")).find('a').removeClass("fa-check-circle")
                                }
                                break;
                            case -2008: // 聊天返回
                                var resChildMessage = root.lookupType("SoupMessage.ChatRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $("#game-round-message").val("")
                                break;
                            case -2009: // mc回复返回
                                var resChildMessage = root.lookupType("SoupMessage.AnswerRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                window.location = "#game-round"
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
                                // 判断房间人员是否有变动
                                if (resMessage.seatsChange && resMessage.seatsChange.length > 0) {
                                    addMember(resMessage.seatsChange)
                                }
                                // 判断是否有人发送消息
                                if (resMessage.changedMsg && resMessage.changedMsg.length > 0) {
                                    appendAllMsg(resMessage.changedMsg)
                                }
                                if (resMessage.status == 2) {
                                    // 选题
                                    showQuestion(resMessage.selectQuestions)
                                } else if (resMessage.status == 3) {
                                    start(resMessage)
                                } else if (resMessage.status == 1) {
                                    $("#game-round-message-list").empty()
                                    // 房间准备中
                                    if (resMessage.question && resMessage.question.content) {
                                        $("#game-question-content").find("p").html(resMessage.question.content)
                                        $("#game-question-content").find(".close").remove()
                                        window.location = "#game-question-content"
                                    }
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
    if (!checkServer()) {
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
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 创建房间
function createRoom() {
    if (!checkServer()) {
        return
    }
    let roomName = $("#create-room-name").val()
    if (roomName == "") {
        layer.msg("请填写房间名称")
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            let roomMax = 10
            let roomPassword = $("#create-room-password").val()
            var protocol = 2002
            var childMessage = root.lookupType("SoupMessage.CreateRoomReq");
            var childData = childMessage.fromObject({ password: roomPassword, name: roomName, max: roomMax })
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 加入房间
function joinRoomInternal(roomId, password) {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2003
            var childMessage = root.lookupType("SoupMessage.JoinRoomReq");
            var childData = childMessage.fromObject({ roomId: roomId, password: password })
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 加入房间选项
function joinRoom(hasPassword, roomId) {
    if (!checkServer()) {
        return
    }
    if (!hasPassword) {
        $("#join-room-password").attr("disabled", true)
    } else {
        $("#join-room-password").removeAttr("disabled")
    }
    $("#join-room-id").val(roomId)
    window.location = "#join-room"
}

// 确认加入房间
function confirmJoinRoom() {
    if (!checkServer()) {
        return
    }
    var roomId = $("#join-room-id").val()
    var password = $("#join-room-password").val()
    if (roomId == "") {
        layer.msg("请填写房号")
        return
    }
    joinRoomInternal(roomId, password)
}

// 添加成员
function addMember(members) {
    if (!checkServer()) {
        return
    }
    $.each(members, function () {
        if (this.leave) {
            $("#room-prepare-" + this.aid).remove()
        } else {
            if (sessionStorage.getItem("userId") == this.aid) {
                if (this.mc) {
                    IS_MC = true
                }
                if (this.owner) {
                    IS_OWNER = true;
                }
                if (this.status == 3 || this.status == 4) {
                    IS_PREPARE = true
                } else {
                    IS_PREPARE = false
                }
            }
            let role = "-"
            if (this.owner && this.mc) {
                role = "房主&MC"
            } else {
                if (this.owner) {
                    role = "房主"
                } else if (this.mc) {
                    role = "MC"
                }
            }
            let icon = "fa-check-circle"
            // 判断准备
            if (this.status != 3) {
                icon = "fa-times-circle"
            }
            if ($("#room-prepare-" + this.aid).length > 0) {
                $("#room-prepare-" + this.aid).remove()
            }
            $("#room-prepare-member").append('<li id="room-prepare-' + this.aid + '"><span>' + role + '</span><a href="javascript:void(0)" class="icon solid ' + icon + '"></a>' + this.avaName + '</li>')
        }
    })
}

// 离开房间选项
function leaveRoom() {
    if (!checkServer()) {
        return
    }
    $("#leave-room").find(".close").remove();
    window.location = "#leave-room"
}

// 取消离开房间
function cancelLeaveRoom() {
    window.location = "#room-prepare"
}

// 确认离开房间
function leaveRoomConfirm() {
    if (!checkServer()) {
        return
    }
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
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 准备游戏
function prepare() {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2005
            var childMessage = root.lookupType("SoupMessage.PrepareReq");
            var childData = childMessage.fromObject({ ok: !IS_PREPARE })
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 回车发送
$("#game-round-message").on('keypress', function (event) {
    if (event.keyCode == 13) {
        sendMessage()
    }
});

// 发送内容
function sendMessage() {
    console.log(1)
    if (!checkServer()) {
        return
    }
    var content = $("#game-round-message").val()
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
                messageCreate = baseMessage.fromObject({
                    protocol: protocol,
                    code: 0,
                    data: childMessage.encode(childData).finish()
                });
                buffer = baseMessage.encode(messageCreate).finish();
                websocket.send(buffer);
            });
        });
    }
}

// 呈现汤普
function showQuestion(questions) {
    if (!checkServer()) {
        return
    }
    $("#question-list").empty()
    // 选题中
    $.each(questions, function () {
        let question = '<div onclick="selectQuestion(' + "'" + this.id + "'" + ');"><h4>' + this.title + '</h4><blockquote>' + this.question + '</blockquote></div><hr>'
        $("#question-list").append(question)
    })
    $("#select-question").find(".close").remove()
    window.location = "#select-question"
}

// 选择汤普
function selectQuestion(id) {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2011
            var childMessage = root.lookupType("SoupMessage.SelectQuestionReq");
            var childData = childMessage.fromObject({ id: id })
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 呈现所有聊天内容
function appendAllMsg(msgs) {
    if (!checkServer()) {
        return
    }
    $.each(msgs, function () {
        // 回答转换
        let answer = ''
        switch (this.answer) {
            case 1: // 未回答
                answer = ''
                break;
            case 2:
                answer = '不相关'
                break;
            case 3:
                answer = '是'
                break;
            case 4:
                answer = '否'
                break;
            case 5:
                answer = '是或不是'
                break;
        }
        if ($("#message-" + this.id).length > 0) {
            // 修改
            $("#message-" + this.id).find("div").find("p").find("i").html(answer)
        } else {
            let li = '<li onclick="answerMessage(' + "'" + this.id + "'" + ', '+"'" + this.content + "'"+');" id="message-' + this.id + '"><div>'
            // 用户头像
            li += '<div class="message-list-avatar"><a href="javascript:void(0)" class="icon solid fa-user"></a></div>'
            // 内容 + 回答
            li += '<div class="message-list-content" style="float: left;"><p class="message-list-username">' + this.avaName + '</p>' + this.content + '<p class="message-list-answer"><i>' + answer + '</i></p></div>'
            // 结尾
            li += '</div></li><br>'
            $("#game-round-message-list").append(li)
        }
    })
    var roundMsgContent = $("#game-round-message-div")[0];
    roundMsgContent.scrollTop = roundMsgContent.scrollHeight;
}

function answerMessage(id, content) {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        return
    }
    $("#answer-message-id").val(id)
    $("#answer-message").find(".close").remove()
    // 内容嵌入弹窗
    $("#answer-message-content").html(content)
    window.location = "#answer-message"
}

// mc回答
function replyMessage(answer) {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        return
    }
    let id = $("#answer-message-id").val()

    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var protocol = 2009
            var childMessage = root.lookupType("SoupMessage.AnswerReq");
            var childData = childMessage.fromObject({ id: id, answer: answer })
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
            layer.close(layer.index);
        });
    });
}

// 游戏开始 显示对局页面
function start(room) {
    layer.closeAll()
    $("#game-round-title").html(room.question.title)
    $("#game-round-question-description").html(room.question.question)
    if (IS_MC) {
        $("#end-game-button").css('display', "block")
        $("#show-game-content").css('display', "block")
        $("#check-game-content").html(room.question.content)
    }
    $("#game-round").find(".close").remove()
    window.location = "#game-round"
}

// 查看汤底
function showGameContent() {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        return
    }
    $("#show-game-question-content").find(".close").remove()
    window.location = "#show-game-question-content"
}

// 关闭游戏汤底
function closeGameContent() {
    window.location = "#game-round"
}

// 游戏结束
function endGame() {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        return
    }
    $("#end-game").find(".close").remove()
    window.location = "#end-game"
}

// 取消结束游戏
function cancelEndGame() {
    window.location = "#game-round"
}

// 确认结束游戏
function endGameConfirm() {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        return
    }
    $("#end-game-button").hide()
    $("#show-game-content").hide()
    $("#check-game-content").empty()
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
            messageCreate = baseMessage.fromObject({
                protocol: protocol,
                code: 0,
                data: childMessage.encode(childData).finish()
            });
            buffer = baseMessage.encode(messageCreate).finish();
            websocket.send(buffer);
        });
    });
}

// 弹窗之前清空内容 房间准备
function beforeRoomPrepare() {
    $("#room-prepare-name").empty()
    $("#room-prepare-max").empty()
    $("#room-prepare-id").empty()
    $("#room-prepare-member").empty()
}

// 加入房间弹窗
function roomPrepare() {
    if (!checkServer()) {
        return
    }
    $("#room-prepare").find(".close").remove()
    window.location = "#room-prepare"
}

// 菜单创建房间
function menuCreateRoom() {
    if (!checkServer()) {
        return
    }
    window.location = "#create-room"
}

// 菜单加入房间
function menuJoinRoom() {
    if (!checkServer()) {
        return
    }
    window.location = "#join-room"
}