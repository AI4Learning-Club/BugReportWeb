export class ApiError extends Error {
  status: number;
  rawMessage: string | string[];

  constructor(status: number, rawMessage: string | string[]) {
    const text = Array.isArray(rawMessage) ? rawMessage.join('；') : rawMessage;
    super(text || '请求失败');
    this.name = 'ApiError';
    this.status = status;
    this.rawMessage = rawMessage;
  }
}

const ERROR_MESSAGE_MAP: Record<string, string> = {
  'No personnel changes provided': '请先选择要变更的人员',
  'owner cannot also be listed as related user': '负责人不能同时列为相关人员',
  'Owner cannot join as related personnel': '负责人不能加入为相关人员',
  'Already listed as related personnel': '你已是相关人员',
  'Already the owner': '你已是负责人',
  'No owner assigned': '当前未指定负责人',
  'One or more users are invalid or inactive': '所选用户无效或已停用',
  'You do not have permission to join as related personnel': '你没有加入相关人的权限',
  'You do not have permission to become the owner': '你没有成为负责人的权限',
  'You do not have permission to delegate related personnel': '你没有委派相关人的权限',
  'You do not have permission to delegate the owner': '你没有委派负责人的权限',
  'You are not listed as related personnel': '你不在相关人员列表中',
  'Insufficient permissions': '没有执行此操作的权限',
  'Missing bearer token': '请先登录',
  'Invalid bearer token': '登录已失效，请重新登录',
  'User is not active': '账号未激活或已停用',
  'Invalid credentials': '用户名或密码错误',
  'User is pending approval or disabled': '账号待审核或已停用',
  'username, password and displayName are required': '请填写用户名、密码和显示名',
  'password must be at least 6 characters': '密码至少需要 6 个字符',
  'Only admins can access deleted bugs': '仅管理员可访问已删除的 bug',
  'Only admins can access deleted features': '仅管理员可访问已删除的功能',
  'Bug not found': 'Bug 不存在',
  'Feature not found': '功能不存在',
  'systemId, title and description are required': '请填写系统、标题和描述',
  'System is not available for new bugs': '该系统不可用于新建 bug',
  'System is not available for bugs': '该系统不可用于 bug',
  'System is not available for new features': '该系统不可用于新建功能',
  'System is not available': '该系统不可用',
  'systemId cannot be empty': '系统不能为空',
  'title cannot be empty': '标题不能为空',
  'description cannot be empty': '描述不能为空',
  'Only admins or creators can delete bugs': '仅管理员或创建者可删除 bug',
  'Only admins can permanently delete bugs': '仅管理员可彻底删除 bug',
  'Only deleted bugs can be permanently removed': '仅已删除的 bug 可彻底移除',
  'Activity not found': '活动记录不存在',
  'Bug already has this status': 'Bug 已是该状态',
  'Feature already has this status': '功能已是该状态',
  'file is required': '请选择文件',
  'Screenshot not found': '截图不存在',
  'Only admins, bug creators or uploaders can delete screenshots': '仅管理员、创建者或上传者可删除截图',
  'Only admins or authors can edit runtime info': '仅管理员或作者可编辑运行信息',
  'Only admins or authors can delete runtime info': '仅管理员或作者可删除运行信息',
  'logText cannot be empty': '日志内容不能为空',
  'Users cannot retest bugs they created': '不能复测自己创建的 bug',
  'result must be APPEARED or NOT_APPEARED': '复测结果无效',
  'runtime info title and logText are required': '请填写运行信息标题和日志内容',
  'Invalid severity': '严重程度无效',
  'status must be OPEN or FIXED': '状态必须为待处理或已修复',
  'note is required': '请填写备注',
  'deleted must be active, only or all': '删除筛选参数无效',
  'Only admins or creators can edit bugs': '仅管理员或创建者可编辑 bug',
  'Runtime info not found': '运行信息不存在',
  'status must be PLANNED, IN_PROGRESS or DONE': '状态必须为计划中、进行中或已完成',
  'Only admins or creators can delete features': '仅管理员或创建者可删除功能',
  'Only admins can permanently delete features': '仅管理员可彻底删除功能',
  'Feature must be soft-deleted first': '功能须先移入回收站',
  'Invalid priority': '优先级无效',
  'reason is required': '请填写原因',
  'Only admins or creators can edit features': '仅管理员或创建者可编辑功能',
  'Unsupported import version': '不支持的导入版本',
  'name is required': '请填写名称',
  'name cannot be empty': '名称不能为空',
  'Cannot delete a role assigned to users': '无法删除已分配给用户的角色',
  'roles must be a non-empty array': '角色列表不能为空',
  'role name is required': '请填写角色名称',
  'Role not found': '角色不存在',
  'displayName is required': '请填写显示名',
  'Admins cannot remove their own admin flag': '管理员不能取消自己的管理员身份',
  'status is required': '请填写状态',
  'Users cannot disable their own account': '不能停用自己的账号',
  'Only disabled users can be deleted': '仅可删除已禁用的用户',
  'Users cannot delete their own account': '不能删除自己的账号',
  'Cannot delete user with existing bug or feature records': '该用户仍有关联的 Bug 或功能记录，无法删除',
  'User not found': '用户不存在',
  'Cannot delete a system that already has bugs': '无法删除已有 bug 的系统',
  'System not found': '系统不存在'
};

const STATUS_FALLBACK: Record<number, string> = {
  401: '登录已过期或凭据无效，请重新登录',
  403: '没有执行此操作的权限',
  404: '请求的资源不存在'
};

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function translateMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return '';
  if (ERROR_MESSAGE_MAP[trimmed]) return ERROR_MESSAGE_MAP[trimmed];
  if (hasChinese(trimmed)) return trimmed;
  return `操作失败：${trimmed}`;
}

function translateMessages(messages: string | string[]) {
  if (Array.isArray(messages)) {
    return messages.map((item) => translateMessage(item)).filter(Boolean).join('；') || '请求失败';
  }
  return translateMessage(messages) || '请求失败';
}

function statusFallback(status: number) {
  if (status >= 500) return '服务器处理失败，请稍后重试';
  return STATUS_FALLBACK[status] ?? '请求失败';
}

export function readError(error: unknown) {
  if (error instanceof ApiError) {
    const translated = translateMessages(error.rawMessage);
    if (translated !== '请求失败') return translated;
    return statusFallback(error.status);
  }

  if (error instanceof Error) {
    if (error.message.startsWith('无法连接后端服务')) {
      return '无法连接后端服务，请确认后端已启动';
    }

    try {
      const parsed = JSON.parse(error.message) as {
        statusCode?: number;
        message?: string | string[];
      };
      if (parsed.message) {
        const translated = translateMessages(parsed.message);
        if (translated !== '请求失败') return translated;
      }
      if (parsed.statusCode) return statusFallback(parsed.statusCode);
    } catch {
      return translateMessage(error.message);
    }

    return translateMessage(error.message);
  }

  return '请求失败';
}
