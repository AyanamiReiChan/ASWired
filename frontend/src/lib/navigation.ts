export const groups=[
 {name:'工作区',items:[['/','总览','dashboard'],['/subscription-generator','生成订阅','rss'],['/servers','服务器','server'],['/nodes','节点库','layers'],['/sources','外部订阅','link'],['/subscriptions','订阅管理','rss'],['/temporary-subscriptions','临时订阅','clock'],['/templates','模板管理','code'],['/plans','套餐管理','package'],['/members','用户管理','users'],['/portal','成员门户','users'],['/account','账户安全','shield']]},
 {name:'运维',items:[['/traffic','流量分析','chart'],['/limits','限速管理','activity'],['/certificates','证书管理','shield'],['/tasks','任务与发布','tasks'],['/notifications','通知中心','bell'],['/audit','日志管理','file'],['/extensions','扩展能力','layers']]},
];
export const extra=[['/probe','探针监控','activity'],['/komari','Komari 管理','server'],['/settings','系统设置','settings']];
export const navigation=[...groups.flatMap(g=>g.items),...extra];

const memberPages=new Set(['/','/portal','/subscriptions','/nodes','/temporary-subscriptions','/probe','/account','/join','/auth/callback','/auth/authorize']);
export function canAccessPage(role:string|undefined,path:string){
 if(path==='/design'||path.startsWith('/design/'))return false;
 return role==='admin'||role==='user'&&memberPages.has(path);
}
