import React from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock, useDialogFocus, downloadText, copyText } from '../lib/ui.js';
import { profile } from '../data/profile.js';
import Icon from './Icon.jsx';
function Dialog({ title, onClose, children, className = '' }) {
  useScrollLock();
  const ref = useDialogFocus(onClose);
  React.useEffect(() => {
    const app = document.querySelector('.portfolio-app');
    const wasInert = app?.inert;
    if (app) app.inert = true;
    return () => {
      if (app) app.inert = wasInert;
    };
  }, []);
  return createPortal(
    <div
      className={'dialog-backdrop'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog-panel ${className}`}
        ref={ref}
        role={'dialog'}
        aria-modal={'true'}
        aria-label={title}
      >
        <div className={'dialog-header'}>
          <span className={'eyebrow'}>{title}</span>
          <button className={'round-button'} aria-label={'关闭对话框'} onClick={onClose}>
            <Icon name={'close'} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export { Dialog };
function ContactDialog({ onClose, initialType = '品牌与平面设计', initialIdea = '' }) {
  const [name, setName] = React.useState(''),
    [email, setEmail] = React.useState(''),
    [type, setType] = React.useState(initialType),
    [idea, setIdea] = React.useState(initialIdea),
    [status, setStatus] = React.useState('');
  const text = () =>
    `致 ${profile.name}：\n\n你好，我是 ${name.trim() || '一位新的合作伙伴'}。\n合作方向：${type}\n需求：${idea.trim() || '希望进一步沟通合作的可能。'}\n回复邮箱：${email.trim() || '待补充'}\n\n期待交流。`;
  const submit = async (e) => {
    e.preventDefault();
    const copied = await copyText(text());
    setStatus(
      copied ? '合作邀约已复制。未发送任何邮件。' : '自动复制未获授权。请选中下方文本手动复制。',
    );
  };
  return (
    <Dialog title={'CONTACT / 合作邀约'} onClose={onClose}>
      <h2>
        {'把你的想法'}
        <br />
        <em>{'带进下一帧。'}</em>
      </h2>
      <form onSubmit={submit} className={'contact-form'}>
        <div className={'form-row'}>
          <label>
            {'你的称呼'}
            <input
              autoComplete={'name'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={'怎么称呼你'}
            />
          </label>
          <label>
            {'回复邮箱'}
            <input
              type={'email'}
              autoComplete={'email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={'you@example.com'}
            />
          </label>
        </div>
        <label>
          {'合作方向'}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {[...profile.skills, '其他创意合作'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          {'简单说说你的想法'}
          <textarea
            rows={'3'}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={'项目背景、内容、时间安排……'}
          />
        </label>
        <div className={'form-actions'}>
          <button type={'submit'} className={'primary-button'}>
            {'复制合作邀约 '}
            <Icon name={'copy'} />
          </button>
          {profile.email && (
            <a
              className={'text-button'}
              href={`mailto:${profile.email}?subject=${encodeURIComponent(`作品集合作邀约 · ${type}`)}&body=${encodeURIComponent(text())}`}
            >
              {'打开邮件草稿 '}
              <Icon name={'mail'} />
            </a>
          )}
        </div>
      </form>
      <p className={'content-note'}>
        {profile.email
          ? `收件人：${profile.email}。表单内容仅用于生成你的邮件草稿。`
          : '尚未配置收件邮箱。此处可以整理并复制邀约，不会上传或发送表单内容。'}
      </p>
      <p className={'action-status'} aria-live={'polite'}>
        {status}
      </p>
      {status.includes('手动') && (
        <textarea
          className={'copy-fallback'}
          readOnly
          value={text()}
          onFocus={(e) => e.target.select()}
        />
      )}
    </Dialog>
  );
}
export { ContactDialog };
function ResumeDialog({ onClose }) {
  const summary = `${profile.name}\n${profile.title}\n\n能力方向\n${profile.skills.map((s) => '— ' + s).join('\n')}\n\n作品类型\n公众号视觉内容、品牌与平面设计、影像与创意实验。\n\n说明\n这是根据原项目内容整理的作品与能力摘要，不是完整任职简历。正式经历和联系方式尚待本人补充。`;
  return (
    <Dialog title={'PROFILE / 个人能力档案'} onClose={onClose}>
      <h2>
        {'KILIAN'}
        <br />
        <em>{'ZHOU.'}</em>
      </h2>
      <p className={'profile-title'}>{profile.title}</p>
      <div className={'profile-skills'}>
        {profile.skills.map((s, i) => (
          <div key={s}>
            <small>
              {'0'}
              {i + 1}
            </small>
            <span>{s}</span>
            <Icon name={'diagonal'} />
          </div>
        ))}
      </div>
      <p className={'content-note'}>
        {
          '正式简历文件、任职信息与联系方式尚未提供。以下导出的是作品与能力摘要，不会将原站的项目示例冒充完整履历。'
        }
      </p>
      <div className={'form-actions'}>
        <button
          className={'primary-button'}
          onClick={() => downloadText('Kilian_Zhou_Profile.txt', summary)}
        >
          {'导出能力摘要 '}
          <Icon name={'download'} />
        </button>
        {profile.resumeUrl ? (
          <a className={'text-button'} href={profile.resumeUrl} download>
            {'下载完整简历 '}
            <Icon name={'download'} />
          </a>
        ) : (
          <span className={'resume-pending'}>{'完整简历待上传'}</span>
        )}
      </div>
    </Dialog>
  );
}
export { ResumeDialog };
