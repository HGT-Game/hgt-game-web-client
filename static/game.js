document.write("<script language=javascript src='/static/code.js'></script>");
document.write("<script language=javascript src='/static/main.js'></script>");

// 检查服务
function checkServer() {
    if (!localStorage.getItem("token")) {
        showTouristLogin()
        return false
    }
    // 判断weboskcet是否连接
    if (!WEBSOCKET_CONNECT) {
        showTouristLogin()
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
                var childMessage = root.lookupType("GameMessage.HeartBeatReq");
                var childData = childMessage.fromObject({})
                childMessageSend(2, baseMessage, childMessage, childData)
            });
        }, this.timeout)
    }
}

// 游戏服务
function gameServer(authorization, username, password) {
    let url = WSS_DOMAIN;
    if (authorization !== "") {
        url = WSS_DOMAIN + "?Authorization=" + authorization
    }

    WEBSOCKET_OBJ = new WebSocket(url);
    WEBSOCKET_OBJ.binaryType = 'arraybuffer';
    WEBSOCKET_OBJ.onopen = function () {
        heartCheck.start();
        WEBSOCKET_CONNECT = true
        if (authorization === "") {
            // 发送登录
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                var childMessage = root.lookupType("GameMessage.LoginReq");
                var childData = childMessage.fromObject({ username: username, password: password })
                childMessageSend(1002, baseMessage, childMessage, childData)
            });
        } else {
            // 发送获取数据
            protobuf.load("protos/GameMessage.proto", function (err, root) {
                if (err) throw err;
                var baseMessage = root.lookupType("GameMessage.Message");
                protobuf.load("protos/SoupMessage.proto", function (err, root) {
                    if (err) throw err;
                    var childMessage = root.lookupType("SoupMessage.LoadReq");
                    var childData = childMessage.fromObject({})
                    childMessageSend(2012, baseMessage, childMessage, childData)
                });
            });
        }
    }
    WEBSOCKET_OBJ.error = function () {
        console.log('连接错误')
        WEBSOCKET_CONNECT = false
        // 清空localStorage
        localStorage.clear()
    }
    WEBSOCKET_OBJ.onclose = function () {
        console.log('断开');
        WEBSOCKET_CONNECT = false
    }
    WEBSOCKET_OBJ.onmessage = function (e) {
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
                                addMember(resMessage.room.seatsChange)
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
                                if (resMessage.room.mcId == localStorage.getItem("userId") && resMessage.room.status == 2) {
                                    // 选题中
                                    layer.msg("选题中")
                                    showQuestion(resMessage.room.selectQuestions)
                                    ROOM_IS_GAMING = true
                                } else if (resMessage.room.status == 3) {
                                    // 对局开始
                                    start(resMessage.room)
                                    ROOM_IS_GAMING = true
                                    appendAllMsg(resMessage.room.msg)
                                } else {
                                    roomPrepare()
                                    layer.msg("成功加入房间")
                                }
                                // 判断对局是否可以离开
                                if (resMessage.room.leaveForPlaying == 2) {
                                    $("#leave-game-button").css("display", "block")
                                } else if (resMessage.room.leaveForPlaying == 1) {
                                    $("#leave-game-button").hide()
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
                                // 房间不是游戏中
                                ROOM_IS_GAMING = false
                                layer.msg("离开房间")
                                window.location = "#"
                                break;
                            case -2005: // 准备返回
                                var resChildMessage = root.lookupType("SoupMessage.PrepareRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                IS_PREPARE = !IS_PREPARE
                                if (IS_PREPARE) {
                                    $("#room-prepare-button").val("取消准备")
                                    $("#room-prepare-" + localStorage.getItem("userId")).find('a').removeClass("fa-times-circle")
                                    $("#room-prepare-" + localStorage.getItem("userId")).find('a').addClass("fa-check-circle")
                                } else {
                                    $("#room-prepare-button").val("准备")
                                    $("#room-prepare-" + localStorage.getItem("userId")).find('a').addClass("fa-times-circle")
                                    $("#room-prepare-" + localStorage.getItem("userId")).find('a').removeClass("fa-check-circle")
                                }
                                break;
                            case -2006: // 踢人返回
                                var resChildMessage = root.lookupType("SoupMessage.PrepareRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $("#show-kick-button").hide()
                                roomPrepare()
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
                                ROOM_IS_GAMING = false
                                $("#end-game-button").hide()
                                $("#show-game-content").hide()
                                $("#show-game-notes").hide()
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
                            case -2013: // 加入笔记
                                var resChildMessage = root.lookupType("SoupMessage.AddNoteRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                layer.msg("添加笔记成功")
                                if (resMessage.note.type != 1) {
                                    showNotes([resMessage.note], false)
                                }
                                $("#customize-note-content").val("")
                                break;
                            case -2014: // 删除笔记
                                var resChildMessage = root.lookupType("SoupMessage.AddNoteRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                let id = $("#delete-user-note-id").val()
                                $("#note-list-id-" + id).remove()
                                layer.msg("已删除笔记")
                                break;
                            case -2015: // 查询笔记
                                var resChildMessage = root.lookupType("SoupMessage.LoadNoteRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                showNotes(resMessage.notes, true)
                                break;
                            case -2901: // 接收房间消息
                                var resChildMessage = root.lookupType("SoupMessage.RoomPush");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                // 判断房间人员是否有变动
                                if (resMessage.seatsChange && resMessage.seatsChange.length > 0) {
                                    addMember(resMessage.seatsChange)
                                }
                                // 判断对局是否可以离开
                                if (resMessage.leaveForPlaying == 2) {
                                    $("#leave-game-button").css("display", "block")
                                } else if (resMessage.leaveForPlaying == 1) {
                                    $("#leave-game-button").hide()
                                }
                                // 判断是否有人发送消息
                                if (resMessage.changedMsg && resMessage.changedMsg.length > 0) {
                                    appendAllMsg(resMessage.changedMsg)
                                }
                                if (resMessage.status == 2) {
                                    // 选题
                                    showQuestion(resMessage.selectQuestions)
                                    ROOM_IS_GAMING = true
                                } else if (resMessage.status == 3) {
                                    start(resMessage)
                                    ROOM_IS_GAMING = true
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

// 子消息入口
function childMessageSend(protocol, baseMessage, childMessage, childData) {
    messageCreate = baseMessage.fromObject({
        protocol: protocol,
        code: 0,
        data: childMessage.encode(childData).finish()
    });
    buffer = baseMessage.encode(messageCreate).finish();
    WEBSOCKET_OBJ.send(buffer);
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
            var childMessage = root.lookupType("SoupMessage.RoomHallReq");
            var childData = childMessage.fromObject({})
            childMessageSend(2001, baseMessage, childMessage, childData)
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
            var childMessage = root.lookupType("SoupMessage.CreateRoomReq");
            var childData = childMessage.fromObject({ password: roomPassword, name: roomName, max: roomMax })
            childMessageSend(2002, baseMessage, childMessage, childData)
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
            var childMessage = root.lookupType("SoupMessage.JoinRoomReq");
            var childData = childMessage.fromObject({ roomId: roomId, password: password })
            childMessageSend(2003, baseMessage, childMessage, childData)
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
        // 1:主动离开 2:被踢
        if (this.leave == 1 || this.leave == 2) {
            // 判断是否当前用户.如果是的话则关闭窗口
            if (this.aid == localStorage.getItem("userId") && this.leave == 2) {
                // 被踢的是当前用户
                layer.closeAll()
                layer.msg("你被移出房间")
                window.location = "#"
            } else {
                if (this.leave == 1) {
                    layer.msg(this.avaName + "离开房间")
                } else {
                    layer.msg(this.avaName + "被踢出房间")
                }
            }
            $("#room-prepare-" + this.aid).remove()
        } else {
            if (localStorage.getItem("userId") == this.aid) {
                if (this.mc) {
                    IS_MC = true
                    // 代表是mc
                    $("#room-prepare-button").val("开始")
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
            let role = "玩家"
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
            layer.msg(this.avaName + '加入房间')
            // background-image: url(https://static.sunanzhi.com/hgt/avatar/hgt_avatar_3.jpg);
            $("#room-prepare-member").append(
                '<li id="room-prepare-' + this.aid + '">' +
                '<span>' + role + '</span>' +
                '<a href="javascript:void(0)" style="background-image: url('+this.avaHead+');" onclick="showRoomMember(' + "'" + this.aid + "'" + ', ' + "'" + this.avaName + "'" + ');" class="icon solid ' + icon + '"></a>' + this.avaName +
                '</li>'
            )
        }
    })
}

// 离开房间选项
function leaveRoom(id) {
    if (!checkServer()) {
        return
    }
    $("#cancel-leave-id").val(id)
    $("#leave-room").find(".close").remove();
    window.location = "#leave-room"
}

// 取消离开房间
function cancelLeaveRoom() {
    let id = $("#cancel-leave-id").val()
    window.location = "#" + id
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
            var childMessage = root.lookupType("SoupMessage.LeaveRoomReq");
            var childData = childMessage.fromObject({})
            childMessageSend(2004, baseMessage, childMessage, childData)
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
            var childMessage = root.lookupType("SoupMessage.PrepareReq");
            var childData = childMessage.fromObject({ ok: !IS_PREPARE })
            childMessageSend(2005, baseMessage, childMessage, childData)
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
                var childMessage = root.lookupType("SoupMessage.ChatReq");
                var childData = childMessage.fromObject({ content: content })
                childMessageSend(2008, baseMessage, childMessage, childData)
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
            var childMessage = root.lookupType("SoupMessage.SelectQuestionReq");
            var childData = childMessage.fromObject({ id: id })
            childMessageSend(2011, baseMessage, childMessage, childData)
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
        let answer = answerSwitch(this.answer)
        if ($("#message-" + this.id).length > 0) {
            // 修改
            $("#message-" + this.id).find("div").find("p").find("i").html(answer)
        } else {
            let li = '<li id="message-' + this.id + '"><div>'
            // 用户头像
            li += '<div class="message-list-avatar"><a href="javascript:void(0)" style="background-image: url('+this.avaHead+');" onclick="showRoomMember(' + "'" + this.aid + "'" + ', ' + "'" + this.avaName + "'" + ');"></a></div>'
            // 内容 + 回答
            li += '<div class="message-list-content" style="float: left;"><p class="message-list-username">' + this.avaName + '</p><span  onclick="answerMessage(' + "'" + this.id + "'" + ', ' + "'" + this.content + "'" + ');">' + this.content + '</span><p class="message-list-answer"><i>' + answer + '</i></p></div>'
            // 结尾
            li += '</div></li><br>'
            $("#game-round-message-list").append(li)
        }
    })
    var roundMsgContent = $("#game-round-message-div")[0];
    roundMsgContent.scrollTop = roundMsgContent.scrollHeight;
}
// 回答转换
function answerSwitch(status) {
    let answer = ''
    switch (status) {
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
    return answer
}

// MC 回答
function answerMessage(id, content) {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        // 非mc 静默添加笔记
        addNote(id)
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
            var childMessage = root.lookupType("SoupMessage.AnswerReq");
            var childData = childMessage.fromObject({ id: id, answer: answer })
            childMessageSend(2009, baseMessage, childMessage, childData)
        });
    });
}

// 游戏开始 显示对局页面
function start(room) {
    if (room.question) {
        if (room.question.title) {
            $("#game-round-title").html(room.question.title)
        }
        if (room.question.question) {
            $("#game-round-question-description").html(room.question.question)
        }
    }
    if (IS_MC) {
        $("#end-game-button").css('display', "block")
        $("#show-game-content").css('display', "block")
        if (room.question && room.question.content) {
            $("#check-game-content").html(room.question.content)
        }
    } else {
        $("#show-game-notes").css('display', "block")
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

    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var childMessage = root.lookupType("SoupMessage.EndReq");
            var childData = childMessage.fromObject({})
            childMessageSend(2010, baseMessage, childMessage, childData)
        });
    });
}

// 测试
function test() {
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var childMessage = root.lookupType("SoupMessage.CreateRoomReq");
            var childData = childMessage.fromObject({})
            childMessageSend(3000, baseMessage, childMessage, childData)
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
    // 判断是否mc
    if (IS_MC) {
        $("#room-prepare-button").val("开始")
    } else {
        if (IS_PREPARE) {
            $("#room-prepare-button").val("取消准备")
        } else {
            $("#room-prepare-button").val("准备")
        }
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

// 查看用户信息
function showRoomMember(userId, username) {
    if (!checkServer()) {
        return
    }
    // 房主 
    if (IS_OWNER && userId != localStorage.getItem("userId")) {
        $("#show-kick-button").css("display", "block")
    }
    $("#room-member-info").find(".close").remove()
    $("#room-member-id").html(userId)
    $("#room-member-username").html(username)
    window.location = "#room-member-info"
}

// 关闭查看用户信息
function closeMemberInfo() {
    if (!checkServer()) {
        return
    }
    $("#show-kick-button").hide()
    if (ROOM_IS_GAMING) {
        window.location = "#game-round"
    } else {
        roomPrepare()
    }
}

// 踢掉用户
function kickRoom() {
    if (!checkServer()) {
        return
    }
    let userId = $("#room-member-id").text()
    console.log($("#room-member-id").text())
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var childMessage = root.lookupType("SoupMessage.KickReq");
            var childData = childMessage.fromObject({ aid: userId })
            childMessageSend(2006, baseMessage, childMessage, childData)
        });
    });
}

// 查看自己的笔记
function showMyNotes() {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            let userId = localStorage.getItem("userId")
            VIEW_OTHER_NOTE_USERNAME = ''
            var childMessage = root.lookupType("SoupMessage.LoadNoteReq");
            var childData = childMessage.fromObject({ aid: userId })
            childMessageSend(2015, baseMessage, childMessage, childData)
        });
    });
}

// 关闭笔记弹窗
function closeUserNote() {
    $("#user-notes").hide()
    window.location = "#game-round"
}

// 静默添加笔记
function addNote(id) {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var childMessage = root.lookupType("SoupMessage.AddNoteReq");
            var childData = childMessage.fromObject({ messageId: id })
            childMessageSend(2013, baseMessage, childMessage, childData)
        });
    });
}

// 展示笔记
function showNotes(notes, isEmpty) {
    if (isEmpty) {
        $("#user-note-list").empty()
    }
    $.each(notes, function () {
        let note = ''
        let content = ''
        let answer = ''
        if (this.type == 1) {
            // 引用
            content = this.chatMessage.content
            // 查看回答 
            answer = answerSwitch(this.chatMessage.answer)
        } else {
            // 自定义
            content = this.content
        }
        let deleteI = ''
        if (VIEW_OTHER_NOTE_USERNAME == "") {
            deleteI = '<i class="icon solid fa-trash-alt" onclick="deleteNote(' + "'" + this.id + "'" + ');"></i>'
        }
        note = '<li id="note-list-id-' + this.id + '" class="user-note-one">' + deleteI + '<div class="user-note-action">' + content + '</div><p class="user-note-answer">' + answer + '</p></li>'
        $("#user-note-list").append(note)
    })
    $("#note-user-name").empty()
    if (VIEW_OTHER_NOTE_USERNAME == "") {
        $("#note-user-name").html("我")
        $("#show-add-customize-note-button").css("display", "block")
    } else {
        $("#note-user-name").html(VIEW_OTHER_NOTE_USERNAME)
        $("#show-add-customize-note-button").hide()
    }
    $("#user-notes").find(".close").remove()
    window.location = "#user-notes"
}

// 添加自定义笔记
function addCustomizeNote() {
    $("#add-customize-note").find(".close").remove()
    window.location = "#add-customize-note"
}

// 确认添加自定义笔记
function addCustomizeNoteConfirm() {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            let content = $("#customize-note-content").val()
            var childMessage = root.lookupType("SoupMessage.AddNoteReq");
            var childData = childMessage.fromObject({ content: content })
            childMessageSend(2013, baseMessage, childMessage, childData)
        });
    });
}

// 关闭自定义笔记
function closeCustomizeNote() {
    window.location = "#user-notes"
}

// 删除笔记
function deleteNote(id) {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            $("#delete-user-note-id").val(id)
            var childMessage = root.lookupType("SoupMessage.DeleteNoteReq");
            var childData = childMessage.fromObject({ id: id })
            childMessageSend(2014, baseMessage, childMessage, childData)
        });
    });
}

// 查看别人的笔记
function viewNotes() {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            let userId = $("#room-member-id").html()
            if (userId != localStorage.getItem("userId")) {
                VIEW_OTHER_NOTE_USERNAME = $("#room-member-username").html()
            }
            var childMessage = root.lookupType("SoupMessage.LoadNoteReq");
            var childData = childMessage.fromObject({ aid: userId })
            childMessageSend(2015, baseMessage, childMessage, childData)
        });
    });
}

