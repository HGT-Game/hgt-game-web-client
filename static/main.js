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

// 注册
function register() {
    let username = $("#register-username").val()
    let account = $("#register-account").val()
    let password = $("#register-password").val()
    let code = $("#register-code").val()
    if (username == "" || account == "" || code == "" || password == "") {
        layer.msg("请正确填写注册信息")
        return
    }
    $.ajax({
        method: "post",
        url: API_DOMAIN + "/auth/register",
        data: { username: username, account: account, password: password, code: code },
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                layer.msg(res.message)
            } else {
                layer.msg("成功注册，请登录")
                window.location = "#login"
            }
        },
        error: function (res) {
            console.log(res)
            layer.msg("出错了，请查看控制台并联系技术人员修复")
        }
    })
}

// 发送验证码
function sendCode(sceneCode) {
    let account = $("#" + sceneCode + "-account").val()
    if (account == "") {
        layer.msg("请正确输入账号")
        return
    }
    $.ajax({
        method: "post",
        url: API_DOMAIN + "/api/message/sendCode",
        data: { account: account, sceneCode: sceneCode + "_by_code" },
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                layer.msg(res.message)
            } else {
                layer.msg("验证码已发送")
            }
        },
        error: function (res) {
            console.log(res)
            layer.msg("出错了，请查看控制台并联系技术人员修复")
        }
    })
}

// 登录
function login(scene) {
    let data = null
    let url = ""
    if (scene == "code") {
        // 验证码登录
        let account = $("#login-account").val()
        let code = $("#login-code").val()
        if (account == "" || code == "") {
            layer.msg("请正确填写信息")
            return
        }
        data = { account: account, code: code }
        url = "/auth/loginByCode"
    } else {
        // 账号密码登录
        let account = $("#account").val()
        let password = $("#password").val()
        if (account == "" || password == "") {
            layer.msg("请正确填写信息")
            return
        }
        data = { account: account, password: password }
        url = "/auth/login"
    }

    $.ajax({
        method: "post",
        url: API_DOMAIN + url,
        data: data,
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                layer.msg(res.message)
            } else {
                layer.msg("成功登录")
                window.location = "#"
                sessionStorage.setItem("token", res.data.accessToken);
                sessionStorage.setItem("userId", res.data.userInfo.userId);
                sessionStorage.setItem("avatar", res.data.userInfo.avatar);
                sessionStorage.setItem("username", res.data.userInfo.username);
                $("#show-logout-button").css('display', "block")
                // 连接websocket
                gameServer(res.data.accessToken)
            }
        },
        error: function (res) {
            console.log(res)
            layer.msg("出错了，请查看控制台并联系技术人员修复")
        }
    })
}

// 游客登录
function touristLogin() {
    let username = $("#tourist-username").val()
    if (username == "") {
        layer.msg("请填写游戏昵称")
        return
    }

    $.ajax({
        method: "post",
        url: API_DOMAIN + "/auth/touristLogin",
        data: { username: username },
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                layer.msg(res.message)
            } else {
                layer.msg("成功登录")
                window.location = "#"
                sessionStorage.setItem("token", res.data.accessToken);
                sessionStorage.setItem("userId", res.data.userInfo.userId);
                sessionStorage.setItem("avatar", res.data.userInfo.avatar);
                sessionStorage.setItem("username", res.data.userInfo.username);
                $("#show-logout-button").css('display', "block")
                // 连接websocket
                gameServer(res.data.accessToken)
            }
        },
        error: function (res) {
            console.log(res)
            layer.msg("出错了，请查看控制台并联系技术人员修复")
        }
    })
}

// 菜单反馈
function menuFeedback() {
    if (!checkServer()) {
        return
    }
    window.location = "#feedback"
}

// 反馈
function feedback() {
    if(!checkServer()){
        return
    }
    let content = $("#feedback-content").val()
    if(content == "") {
        layer.msg("请输入反馈内容")
        return
    }
    $.ajax({
        method: "post",
        url: API_DOMAIN + "/user/feedback",
        beforeSend: function (XMLHttpRequest) {
            XMLHttpRequest.setRequestHeader("Authorization", sessionStorage.getItem("token"));
        },
        header: {Authorization: sessionStorage.getItem("token")},
        data: {content: content},
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                layer.msg(res.message)
            } else {
                layer.msg("感谢您的宝贵建议")
            }
        },
        error: function (res) {
            console.log(res)
            layer.msg("出错了，请查看控制台并联系技术人员修复")
        }
    })
}

// 菜单退出
function showLogout () {
    if (sessionStorage.getItem("token")) {
        window.location = "#logout-options"
    } else {
        $("#show-logout-button").hide()
    }
}

// 退出
function logout() {
    // 清空sessionStorage
    sessionStorage.clear()
    WEBSOCKET_OBJ.close()
    $("#show-logout-button").hide()
    layer.msg("退出成功")
    window.location = "#"
}