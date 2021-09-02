(function ($) {
    "use strict"; 
    $('[data-toggle="tooltip"]').tooltip()
    $('.light-dark-toggle').on('click', function () {
        $(this).toggleClass('active')
    });
    // 打开右边
    $('.rightbar .rightbar-link').on('click', function () {
        $('.rightbar').addClass('open')
    });
    $('.navigation .rightbar-link').on('click', function () {
        $('.rightbar').addClass('open')
    });
    // 关闭右边
    $('.rightbar .close-sidebar').on('click', function () {
        $('.rightbar').removeClass('open')
    });

    // 展示房间信息
    $('.show-room-info').on('click', function () {
        $('.main ').toggleClass('open-room-sidebar')
    });
    // 关闭笔记列表
    $('.close-room-sidebar').on('click', function () {
        $('.main ').toggleClass('open-room-sidebar')
    });

    $('.close-chat-sidebar').on('click', function () {
        $('.main ').removeClass('open-user-sidebar')
    });
    $('.sidebar-toggle-btn').on('click', function () {
        $('body ').toggleClass('open-sidebar-menu')
    });
    $(document).ready(function () {
        $('.choose-skin li').on('click', function () {
            var $body = $('#layout');
            var $this = $(this);
            var existTheme = $('.choose-skin li.active').data('theme');
            $('.choose-skin li').removeClass('active');
            $body.removeClass('theme-' + existTheme);
            $this.addClass('active');
            var newTheme = $('.choose-skin li.active').data('theme');
            $body.addClass('theme-' + $this.data('theme'));
        });
    });
    $(document).ready(function () {
        $('.menu-toggle').on('click', function (e) {
            var $this = $(this); var $content = $this.next();
            if ($($this.parents('ul')[0]).hasClass('list')) {
                var $not = $(e.target).hasClass('menu-toggle') ? e.target : $(e.target).parents('.menu-toggle');
                $.each($('.menu-toggle.toggled').not($not).next(), function (i, val) {
                    if ($(val).is(':visible')) {
                        $(val).prev().toggleClass('toggled');
                        $(val).slideUp();
                    }
                });
            }
            $this.toggleClass('toggled'); $content.slideToggle(320);
        });
    });
    var toggleSwitch = document.querySelector('.light-dark-toggle input[type="checkbox"]');
    var currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            toggleSwitch.checked = true;
        }
    }
    function switchTheme(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark'); 
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }
    toggleSwitch.addEventListener('change', switchTheme, false);
})(jQuery);