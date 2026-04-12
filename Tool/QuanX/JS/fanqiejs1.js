// 获取原始的响应体数据
let body = $response.body;

try {
    // 将 JSON 字符串解析为 JavaScript 对象
    let obj = JSON.parse(body);

    // 判断是否存在我们需要处理的广告视频节点
    if (obj.video_info && obj.video_info.data) {
        
        // 1. 清空所有的视频流播放链接
        if (obj.video_info.data.video_list) {
            obj.video_info.data.video_list = {};
        }
        
        // 2. 抹除广告的封面图（防止留下一个灰色的占位图）
        if (obj.video_info.data.poster_url) {
            obj.video_info.data.poster_url = "";
        }
        
        // 3. 将视频时长归零（有助于让某些强行倒计时的播放器直接跳过）
        if (obj.video_info.data.video_duration) {
            obj.video_info.data.video_duration = 0;
        }

        // 4. (可选) 修改状态码，有时候能让 App 直接判定拉取失败从而跳过
        // obj.video_info.data.status = 0; 
    }

    // 将修改后的对象重新转回 JSON 字符串
    body = JSON.stringify(obj);

} catch (e) {
    // 捕获异常，防止脚本报错导致正常网络请求卡死
    console.log("解析广告 JSON 失败: " + e);
}

// 结束处理，返回篡改后的数据给 App
$done({ body: body });
