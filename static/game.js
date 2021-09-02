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

// 重置flag
function resetFlag() {
    WEBSOCKET_OBJ = null
    // websocket是否连接
    WEBSOCKET_CONNECT = false
    // 是否准备
    IS_PREPARE = false
    // 是否mc
    IS_MC = false
    // 是否房主
    IS_OWNER = false
    // 房间状态
    ROOM_IS_GAMING = false
    // 是否查看别人笔记
    VIEW_OTHER_NOTE_USERNAME = ''
}

// 心跳检测
var heartCheck = {
    timeout: 50000,//ms
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
        resetFlag();
        // 清空localStorage
        localStorage.clear()
    }
    WEBSOCKET_OBJ.onclose = function () {
        console.log('断开');
        resetFlag();
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
                                addMember(resMessage.room.seatsChange)
                                layer.msg("成功创建房间")
                                // 默认准备
                                IS_PREPARE = true
                                // 默认mc
                                IS_MC = true
                                // 默认房主
                                IS_OWNER = true
                                window.location = '/round.html'
                                break;
                            case -2003: // 加入房间返回
                                if(window.location.pathname == '/index.html') {
                                    window.location = '/round.html'
                                }
                                var resChildMessage = root.lookupType("SoupMessage.JoinRoomRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                addMember(resMessage.room.seatsChange)
                                // 房间名
                                $("#round-start-title").html(resMessage.room.roomName)
                                // 关闭房间信息按钮
                                $(".show-room-info").hide()
                                if (resMessage.room.mcId == localStorage.getItem("userId") && resMessage.room.status == 2) {
                                    // 选题中
                                    layer.msg("选题中")
                                    showQuestion(resMessage.room.selectQuestions)
                                    ROOM_IS_GAMING = true
                                } else if (resMessage.room.status == 3) {
                                    closeQuestion()
                                    // 对局开始
                                    start(resMessage.room)
                                    ROOM_IS_GAMING = true
                                }
                                appendAllMsg(resMessage.room.msg)
                                // 判断对局是否可以离开
                                if (resMessage.room.leaveForPlaying == 2) {
                                    $("#leave-game-button").css("display", "block")
                                } else if (resMessage.room.leaveForPlaying == 1) {
                                    $("#leave-game-button").hide()
                                }
                                break;
                            case -2004: // 离开房间
                                var resChildMessage = root.lookupType("SoupMessage.LeaveRoomRes");
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
                                window.location = "/index.html"
                                break;
                            case -2005: // 准备返回
                                var resChildMessage = root.lookupType("SoupMessage.PrepareRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2006: // 踢人返回
                                var resChildMessage = root.lookupType("SoupMessage.KickRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2008: // 聊天返回
                                var resChildMessage = root.lookupType("SoupMessage.ChatRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $("#message-content").val("")
                                break;
                            case -2009: // mc回复返回
                                var resChildMessage = root.lookupType("SoupMessage.AnswerRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2010: // 游戏结束返回
                                var resChildMessage = root.lookupType("SoupMessage.EndRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                ROOM_IS_GAMING = false
                                break;
                            case -2011: // 选题返回
                                var resChildMessage = root.lookupType("SoupMessage.SelectQuestionRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                break;
                            case -2012: // 获取数据返回
                                var resChildMessage = root.lookupType("SoupMessage.LoadRes");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                if (resMessage.reconnect == true) {
                                    if(window.location.pathname == '/index.html') {
                                        window.location = '/round.html'
                                    } else {
                                        // 触发重连 直接请求加入房间
                                        joinRoomInternal(resMessage.roomId, resMessage.password)
                                    }
                                } else {
                                    if(window.location.pathname != '/index.html') {
                                        window.location = '/index.html'
                                    }
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
                                var resChildMessage = root.lookupType("SoupMessage.DeleteNoteReq");
                                resMessage = resChildMessage.decode(baseMessage.data)
                                $("#note-list-id-" + resMessage.id).remove()
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
                                // 判断是否有人发送消息
                                if (resMessage.changedMsg && resMessage.changedMsg.length > 0) {
                                    appendAllMsg(resMessage.changedMsg)
                                }
                                if (resMessage.msg && resMessage.msg.length > 0) {
                                    appendAllMsg(resMessage.msg)
                                }
                                if (resMessage.status == 2) {
                                    // 选题
                                    $("#message-list").empty()
                                    showQuestion(resMessage.selectQuestions)
                                    ROOM_IS_GAMING = true
                                } else if (resMessage.status == 3) {
                                    closeQuestion()
                                    start(resMessage)
                                    ROOM_IS_GAMING = true
                                } else if (resMessage.status == 1) {
                                    ROOM_IS_GAMING = false
                                    // 房间准备中
                                    if (resMessage.question && resMessage.question.content) {
                                        endRoundAfter(resMessage);
                                        layer.confirm(resMessage.question.content, {
                                            title: '汤底',
                                        })
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
                window.location = "/index.html"
            } else {
                if (this.leave == 1) {
                    layer.msg(this.avaName + "离开房间")
                } else {
                    layer.msg(this.avaName + "被踢出房间")
                }
            }
            // 人员列表移除
            $("#member-id-" + this.aid).remove()
        } else {
            if (localStorage.getItem("userId") == this.aid) {
                if (this.mc) {
                    IS_MC = true
                    // 代表是mc，显示开始按钮
                    $("#room-prepare-button").html("开始")
                }
                if (this.owner) {
                    IS_OWNER = true;
                }
                if (this.status == 3 || this.status == 4) {
                    IS_PREPARE = true
                    if (!IS_MC) {
                        $("#room-prepare-button").html("取消准备")
                    }
                } else {
                    IS_PREPARE = false
                    if (!IS_MC) {
                        $("#room-prepare-button").html("准备")
                    }
                }
            }
            // 非游戏状态才需要提示
            if ($("#member-id-" + this.aid).length == 0) {
                layer.msg(this.avaName + '加入房间')
                // 加入房间人员列表
                var memberLi =
                    '<li id="member-id-' + this.aid + '" class="">' +
                    (!this.mc ? ('<div class="hover_action" onclick="kick(&quot;' + this.aid + '&quot;);">' +
                        '<button type="button" class="btn btn-link text-danger"><i class="zmdi zmdi-delete"></i></button>' +
                        '</div>') : '') +
                    '<a href="#" class="card">' +
                    '<div class="card-body">' +
                    '<div class="media">' +
                    '<div class="avatar me-3">' +
                    '<span class="status rounded-circle"></span>' +
                    '<img onclick="showUserDetail(&quot;' + this.aid + '&quot;, &quot;' + this.avaName + '&quot;, &quot;' + this.avaHead + '&quot;);" id="member-avatar-img" class="avatar rounded-circle" src="' + this.avaHead + '">' +
                    '</div>' +
                    '<div class="media-body overflow-hidden">' +
                    '<div class="d-flex align-items-center mb-1">' +
                    '<h6 id="member-name" class="text-truncate mb-0 me-auto">' + this.avaName + '</h6>' +
                    '</div>' +
                    '<div class="text-truncate" id="member-last-content-' + this.aid + '"></div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</a>' +
                    '</li>'

                if (this.mc) {
                    $("#member-list").prepend(memberLi)
                } else {
                    $("#member-list").append(memberLi)
                }
            }
            if (this.status == 3 || this.status == 4) {
                $("#member-id-" + this.aid).addClass("online")
                $("#member-id-" + this.aid).removeClass("away")
            } else {
                $("#member-id-" + this.aid).addClass("away")
                $("#member-id-" + this.aid).removeClass("online")
            }
        }
    })
}


// 离开房间选项
function leaveRoom(id) {
    if (!checkServer()) {
        return
    }
    layer.confirm('是否离开房间', {
        title: '提示',
        btn: ['是']
    }, function () {
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
$("#message-content").on('keypress', function (event) {
    if (event.keyCode == 13) {
        sendMessage()
    }
});

// 发送内容
function sendMessage() {
    if (!checkServer()) {
        return
    }
    var content = $("#message-content").val()
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
        let question = '<li onclick="selectQuestion(&quot;' + this.id + '&quot;);" class="card border-0 mb-2"><h6>' + this.title + '</h6><span>' + this.question + '</span></li>'
        $("#question-list").append(question)
    })
    // 呈现汤普
    $('.main ').toggleClass('open-question-list-sidebar')
}
// 关闭汤普
function closeQuestion() {
    $('.main ').removeClass('open-question-list-sidebar')
    $("#room-prepare-button").hide()
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
        let selfMsg = this.aid == localStorage.getItem("userId")
        // 回答转换
        if ($("#message-" + this.id).length > 0) {
            // 修改
            $("#message-" + this.id).find(".message-answer").html(answerSwitch(selfMsg, this.answer, this.id))
        } else {
            var messageContent = ''
            let msgDate = new Date(this.createdAt)
            let h = msgDate.getHours()
            let m = msgDate.getMinutes()
            let s = msgDate.getSeconds()
            // 判断信息是否自己
            if (selfMsg) {
                messageContent +=
                    '<li id="message-' + this.id + '" class="d-flex message right">' +
                    '<div class="message-body">' +
                    '<span class="date-time text-muted">' + h + ':' + m + ':' + s + '</span>' +
                    '<div class="message-row d-flex align-items-center justify-content-end">' +
                    '<div class="dropdown">' +
                    '<a class="text-muted me-1 p-2 text-muted" href="#" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
                    '<i class="zmdi zmdi-more-vert"></i>' +
                    '</a>' +
                    '<div class="dropdown-menu">' +
                    '<a class="dropdown-item" onclick="addNote(&quot;' + this.id + '&quot;);" href="#">添加笔记</a>' +
                    '</div>' +
                    '</div>' +
                    '<div class="message-content border p-3">' + this.content + '</div>' +
                    '</div>' +
                    answerSwitch(selfMsg, this.answer, this.id) +
                    '</div>' +
                    '</li>'
            } else {
                messageContent +=
                    '<li id="message-' + this.id + '" class="d-flex message">' +
                    '<div class="mr-lg-3 me-2">' +
                    '<img onclick="showUserDetail(&quot;' + this.aid + '&quot;, &quot;' + this.avaName + '&quot;, &quot;' + this.avaHead + '&quot;);" class="avatar sm rounded-circle" src="' + this.avaHead + '" alt="avatar">' +
                    '</div>' +
                    '<div class="message-body">' +
                    '<span class="date-time text-muted">' + this.avaName + ', ' + h + ':' + m + ':' + s + '</span>' +
                    '<div class="message-row d-flex align-items-center">' +
                    '<div class="message-content p-3">' + this.content + '</div>' +
                    '<div class="dropdown">' +
                    '<a class="text-muted ms-1 p-2 text-muted" href="#" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' +
                    '<i class="zmdi zmdi-more-vert"></i>' +
                    '</a>' +
                    '<div class="dropdown-menu dropdown-menu-right">' +
                    '<a class="dropdown-item" onclick="addNote(&quot;' + this.id + '&quot;);" href="#">添加笔记</a>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    answerSwitch(selfMsg, this.answer, this.id) +
                    '</div>' +
                    '</li>'
            }
            $("#message-list").append(messageContent)
            $("#member-last-content-" + this.aid).html(this.content)
        }
    })
    var messageListContent = $("#message-list-div")[0]
    messageListContent.scrollTop = messageListContent.scrollHeight;
}

// 回答转换
function answerSwitch(selfMsg, status, id) {
    if(!ROOM_IS_GAMING) {
        return ''
    }
    let style = ''
    if (selfMsg) {
        style = 'style="float:right;"'
    }
    let answer = ''
    switch (status) {
        case 1: // 未回答
            answer = (IS_MC && !selfMsg ? '<div class="message-row d-flex align-items-center message-answer">' +
                '<button onclick="replyMessage(3, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-primary btn-rounded mb-1 me-1">是</button>' +
                '<button onclick="replyMessage(4, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-danger btn-rounded mb-1 me-1">不是</button>' +
                '<button onclick="replyMessage(5, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-warning btn-rounded mb-1 me-1">是或不是</button>' +
                '<button onclick="replyMessage(2, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-dark btn-rounded mb-1 me-1">无关</button>' +
                '</div>' : '<div class="message-row d-flex align-items-center message-answer" ' + style + '></div>')
            break;
        case 2: // 无关
            answer = (IS_MC ? '<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button onclick="showAllAnswer(&quot;' + id + '&quot;);" type="button" class="btn btn-outline-dark btn-rounded mb-1 me-1">无关</button>' +
                '</div>' : '<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button type="button" class="btn btn-outline-dark btn-rounded mb-1 me-1">无关</button>' +
            '</div>')
            break;
        case 3: // 是
            answer = (IS_MC ? ('<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button onclick="showAllAnswer(&quot;' + id + '&quot;);" type="button" class="btn btn-outline-primary btn-rounded mb-1 me-1">是</button>' +
                '</div>') : ('<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                    '<button type="button" class="btn btn-outline-primary btn-rounded mb-1 me-1">是</button>' +
                    '</div>'))
            break;
        case 4: // 不是
            answer = (IS_MC ? '<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button onclick="showAllAnswer(&quot;' + id + '&quot;);" type="button" class="btn btn-outline-danger btn-rounded mb-1 me-1">不是</button>' +
                '</div>' : '<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button type="button" class="btn btn-outline-danger btn-rounded mb-1 me-1">不是</button>' +
            '</div>')
            break;
        case 5: // 是或不是
            answer = (IS_MC ? '<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button onclick="showAllAnswer(&quot;' + id + '&quot;);" type="button" class="btn btn-outline-warning btn-rounded mb-1 me-1">是或不是</button>' +
                '</div>' : '<div class="message-row d-flex align-items-center message-answer" ' + style + '>' +
                '<button type="button" class="btn btn-outline-warning btn-rounded mb-1 me-1">是或不是</button>' +
            '</div>')
            break;
    }
    return answer
}

function showAllAnswer(id) {
    $("#message-" + id).find(".message-answer").html('<div class="message-row d-flex align-items-center message-answer">' +
        '<button onclick="replyMessage(3, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-primary btn-rounded mb-1 me-1">是</button>' +
        '<button onclick="replyMessage(4, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-danger btn-rounded mb-1 me-1">不是</button>' +
        '<button onclick="replyMessage(5, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-warning btn-rounded mb-1 me-1">是或不是</button>' +
        '<button onclick="replyMessage(2, &quot;' + id + '&quot;);" type="button" class="btn btn-outline-dark btn-rounded mb-1 me-1">无关</button>' +
        '</div>')
}

// mc回答
function replyMessage(answer, id) {
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
            $("#round-start-title").html(room.question.title)
        }
        if (room.question.question) {
            $("#question-description").html(room.question.question)
        }
    }
    if (IS_MC) {
        if (room.question && room.question.content) {
            $("#question-content").html(room.question.content)
            $("#question-content-check").css("display", "block")
            $("#question-content-check-btn").css("display", "block")
        }
    } else {
        $("#question-content-check").hide()
        $("#question-content-check-btn").hide()
    }
    // 显示房间按钮
    $(".show-room-info").css("display", "block")
}

// 游戏结束
function endGame() {
    if (!checkServer()) {
        return
    }
    if (!IS_MC) {
        return
    }
    layer.confirm('是否公布汤底？', {
        title: '提示',
        btn: ['是']
    }, function () {
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
    })
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

// 踢掉用户
function kick(aid) {
    if (!checkServer()) {
        return
    }
    layer.confirm('是否踢掉此玩家', {
        title: '提示',
        btn: ['是']
    }, function () {
        protobuf.load("protos/GameMessage.proto", function (err, root) {
            if (err) throw err
            var baseMessage = root.lookupType("GameMessage.Message")
            protobuf.load("protos/SoupMessage.proto", function (err, root) {
                if (err) throw err
                var childMessage = root.lookupType("SoupMessage.KickReq")
                var childData = childMessage.fromObject({ aid: aid })
                childMessageSend(2006, baseMessage, childMessage, childData)
            });
        })
    })
}

// 展示自己的用户信息
function showMineDetail() {
    showUserDetail(localStorage.getItem("userId"), localStorage.getItem("username"), localStorage.getItem("avatar"))
}

// 展示他人用户信息
function showUserDetail(aid, avaName, avaHead) {
    $('.main ').toggleClass('open-chat-sidebar')
    $("#user-detail-avatar").attr("src", avaHead)
    $("#user-detail-username").html(avaName)
    if (localStorage.getItem("userId") == aid && ROOM_IS_GAMING) {
        $("#add-note-form").css("display", "block")
        VIEW_OTHER_NOTE_USERNAME = ""
    } else {
        $("#add-note-form").hide()
        VIEW_OTHER_NOTE_USERNAME = avaName
    }
    // $("#user-detail-id").html(aid)
    checkNotes(aid)
}

// 关闭用户详情
$('.close-chat-sidebar').on('click', function () {
    $('.main ').removeClass('open-chat-sidebar')
});

// 查看笔记
function checkNotes(aid) {
    if (!checkServer()) {
        return
    }
    protobuf.load("protos/GameMessage.proto", function (err, root) {
        if (err) throw err;
        var baseMessage = root.lookupType("GameMessage.Message");
        protobuf.load("protos/SoupMessage.proto", function (err, root) {
            if (err) throw err;
            var childMessage = root.lookupType("SoupMessage.LoadNoteReq");
            var childData = childMessage.fromObject({ aid: aid })
            childMessageSend(2015, baseMessage, childMessage, childData)
        });
    });
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
        let content = ''
        if (this.type == 1) {
            // 引用
            content = this.chatMessage.content
        } else {
            // 自定义
            content = this.content
        }
        let deleteI = ''
        if (VIEW_OTHER_NOTE_USERNAME == "") {
            deleteI = '<button onclick="deleteNote(' + "'" + this.id + "'" + ');" class="btn btn-sm btn-link"><i class="zmdi zmdi-delete text-danger"></i></button>'
        } else {
            deleteI = '<button onclick="addNote(' + "'" + this.id + "'" + ');" class="btn btn-sm btn-link"><i class="zmdi zmdi-plus"></i></button>'
        }
        let note = '<li id="note-list-id-' + this.id + '" class="card border-0 mb-2">' +
            '<span>' + content + '</span>' +
            deleteI +
            getNoteAnswer(this.chatMessage.answer) +
            '</li>'
        $("#user-note-list").append(note)
    })
}

// 获取笔记回答
function getNoteAnswer(status) {
    let res = ''
    switch (status) {
        case 2: // 无关
            res = '<div>' +
                '<button type="button" class="btn btn-outline-dark btn-rounded mt-2" style="position: inherit;">无关</button>' +
                '</div>'
            break
        case 3: // 是
            res = '<div>' +
                '<button type="button" class="btn btn-outline-primary btn-rounded mt-2" style="position: inherit;">是</button>' +
                '</div>'
            break
        case 4: // 不是
            res = '<div>' +
                '<button type="button" class="btn btn-outline-danger btn-rounded mt-2" style="position: inherit;">不是</button>' +
                '</div>'
            break
        case 5: // 是或不是
            res = '<div>' +
                '<button type="button" class="btn btn-outline-warning btn-rounded mt-2" style="position: inherit;">是或不是</button>' +
                '</div>'
            break
    }

    return res
}

// 确认添加自定义笔记
function addCustomizeNoteConfirm() {
    if(!ROOM_IS_GAMING) {
        return
    }
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
            var childMessage = root.lookupType("SoupMessage.DeleteNoteReq");
            var childData = childMessage.fromObject({ id: id })
            childMessageSend(2014, baseMessage, childMessage, childData)
        });
    });
}

function endRoundAfter(resMessage) {
    $("#message-list").empty()
    $("#round-start-title").html("")
    // 房间准备按钮
    $("#room-prepare-button").css("display", "block")
    // 房间名
    $("#round-start-title").html(resMessage.roomName)
    // 关闭房间信息
    $('.main ').toggleClass('open-room-sidebar')
    $("#question-description").html("")
    $("#question-content").html("")
    // 关闭房间信息按钮
    $(".show-room-info").hide()
    // 展现房间聊天数据
    if (resMessage.msg && resMessage.msg.length > 0) {
        appendAllMsg(resMessage.msg)
    }
}
