let body = $response.body;

try {
    let obj = JSON.parse(body);
    
    // 确认这是视频信息响应
    if (obj.video_info && obj.video_info.data) {
        // 清空视频列表，移除所有清晰度的播放链接
        if (obj.video_info.data.video_list) {
            obj.video_info.data.video_list = {};
        }
        
        // 将视频时长置零
        if (obj.video_info.data.video_duration) {
            obj.video_info.data.video_duration = 0;
        }
        
        // 尝试覆盖状态码，让客户端认为广告源失效
        // obj.code = -1; 
        // obj.message = "ad_blocked";
    }
    
    body = JSON.stringify(obj);
} catch (error) {
    console.log("解析 snssdk 广告视频 JSON 失败: " + error);
}

// 返回修改后的 body
$done({ body });