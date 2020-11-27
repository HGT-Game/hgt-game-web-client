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
                localStorage.setItem("token", res.data.accessToken);
                localStorage.setItem("userId", res.data.userInfo.userId);
                localStorage.setItem("avatar", res.data.userInfo.avatar);
                localStorage.setItem("username", res.data.userInfo.username);
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

// 展示游客登录
function showTouristLogin() {
    changeCaptcha()
    window.location = "#tourist-login"
}

// 更换图形验证码
function changeCaptcha() {
    $.ajax({
        method: "get",
        url: API_DOMAIN + "/api/captcha",
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                layer.msg(res.message)
            } else {
                $("#tourist-captcha-image").attr("src", res.data.base64)
                $("#tourist-captcha-id").val(res.data.captchaId)
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
    let captcha = $("#tourist-captcha").val()
    if (captcha == "") {
        layer.msg("请输入验证码")
        return
    }
    let captchaId = $("#tourist-captcha-id").val()
    if (captchaId == "") {
        layer.msg("非法途径")
        return
    }

    $.ajax({
        method: "post",
        url: API_DOMAIN + "/auth/touristLogin",
        data: { username: username, captchaId: captchaId, captcha: captcha },
        success: function (res) {
            if (res.code != 0 && res.code != 200) {
                changeCaptcha()
                layer.msg(res.message)
            } else {
                layer.msg("成功登录")
                window.location = "#"
                localStorage.setItem("token", res.data.accessToken);
                localStorage.setItem("userId", res.data.userInfo.userId);
                localStorage.setItem("avatar", res.data.userInfo.avatar);
                localStorage.setItem("username", res.data.userInfo.username);
                $("#show-logout-button").css('display', "block")
                $("#tourist-captcha-image").attr("src", "")
                $("#tourist-captcha-id").val("")
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
            XMLHttpRequest.setRequestHeader("Authorization", localStorage.getItem("token"));
        },
        header: {Authorization: localStorage.getItem("token")},
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
    if (localStorage.getItem("token")) {
        window.location = "#logout-options"
    } else {
        $("#show-logout-button").hide()
    }
}

// 退出
function logout() {
    // 清空localStorage
    localStorage.clear()
    WEBSOCKET_OBJ.close()
    $("#show-logout-button").hide()
    layer.msg("退出成功")
    window.location = "#"
}