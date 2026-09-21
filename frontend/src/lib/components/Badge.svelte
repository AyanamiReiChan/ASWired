<script lang="ts">let {value,kind=''}=$props<{value:string;kind?:string}>(); const tone=$derived(kind||(/在线|正常|成功|已支付|启用|已发布|已生效|已核销|可用/.test(value)?'success':/离线|失败|异常|已撤销/.test(value)?'danger':/待|告警|到期|限速|同步|排队|预览/.test(value)?'warning':'neutral'));</script>
<span class={`badge ${tone}`}>{value}</span>
