/* Authentication and shared storage. Demo pages never load this file. */
(() => {
  'use strict';
  const app=window.WeddingApp;
  const message=document.getElementById('auth-message');
  const googleArea=document.getElementById('google-area');
  const sessionActions=document.getElementById('auth-session-actions');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let apiUrl='',sessionKey='',token='',user=null,revision=-1,epoch=0,refreshing=false,authReady=false,registerMode=false;
  function tell(text){message.textContent=text;}
  function remember(value,persistent=false){
    token=value;
    try{localStorage.removeItem(sessionKey)}catch{}
    try{sessionStorage.removeItem(sessionKey)}catch{}
    if(value){try{(persistent?localStorage:sessionStorage).setItem(sessionKey,value)}catch{try{sessionStorage.setItem(sessionKey,value)}catch{}}}
  }
  function restoreToken(){try{const saved=localStorage.getItem(sessionKey);if(saved)return saved}catch{}try{return sessionStorage.getItem(sessionKey)||''}catch{return ''}}
  async function api(path,options={}){
    const headers={...(options.body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{}),...options.headers};
    let response;try{response=await fetch(apiUrl+path,{...options,headers,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)})}catch{throw Object.assign(new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'),{status:0})}
    let result;try{result=await response.json()}catch{throw new Error('서버 응답이 올바르지 않습니다. 연결 주소를 확인해 주세요.')}
    if(!response.ok)throw Object.assign(new Error(result.message||'요청을 처리하지 못했습니다.'),{status:response.status,code:result.error});
    return result;
  }
  function clearAccess(text,forget=false){epoch++;user=null;revision=-1;app.lock();if(forget)remember('');googleArea.hidden=!!token;sessionActions.hidden=!token;tell(text);}
  async function loginButton(){
    googleArea.hidden=false;sessionActions.hidden=true;
    googleArea.innerHTML=`<form id="password-form" style="width:100%;display:grid;gap:12px;text-align:left">
    <label>아이디<input name="username" autocomplete="username" required minlength="3" maxlength="80" placeholder="영문·숫자 3자 이상" style="width:100%"></label>
    <label>비밀번호<input name="password" type="password" autocomplete="${registerMode?'new-password':'current-password'}" required minlength="10" maxlength="128" placeholder="10자 이상" style="width:100%"></label>
    ${registerMode?'<label>이름<input name="name" maxlength="80" required style="width:100%"></label><label>비밀번호 확인<input name="confirm" type="password" autocomplete="new-password" required style="width:100%"></label><details><summary>관리자 최초 등록</summary><p class="smalltext">관리자 아이디는 admin입니다. 일반 가입자는 입력하지 마세요.</p><label>관리자 등록 키<input name="setupKey" type="password" autocomplete="off" style="width:100%"></label></details>':''}
    <label style="display:flex;align-items:center;gap:8px;font-size:.875rem"><input type="checkbox" name="remember" style="width:auto;margin:0"> 로그인 상태 유지 (30일)</label>
    <button class="primary" type="submit">${registerMode?'가입 신청':'로그인'}</button><button type="button" id="switch-auth">${registerMode?'로그인으로 돌아가기':'처음 오셨나요? 회원가입'}</button></form>`;
    document.getElementById('switch-auth').onclick=()=>{registerMode=!registerMode;loginButton()};
    document.getElementById('password-form').onsubmit=async event=>{
      event.preventDefault();const form=event.currentTarget,data=new FormData(form),body=Object.fromEntries(data);body.remember=data.get('remember')==='on';
      if(registerMode&&body.password!==body.confirm){tell('비밀번호 확인이 일치하지 않습니다.');return}
      const generation=++epoch;form.querySelectorAll('button').forEach(b=>b.disabled=true);tell(registerMode?'가입 신청 중입니다.':'로그인 중입니다.');
      try{const result=await api(registerMode?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(body)});if(generation!==epoch)return;form.reset();remember(result.token,body.remember);user=null;revision=-1;await refresh()}
      catch(e){if(generation===epoch)tell(e.message)}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false)}
    };
    tell(registerMode?'가입 후 관리자가 승인하면 실제 자료를 볼 수 있습니다.':'승인된 계정만 실제 일정·하객·예산을 볼 수 있습니다.');
  }
  async function refresh(){
    if(!token){if(authReady)await loginButton();return}
    if(refreshing||app.busy())return;refreshing=true;const generation=epoch;
    try{
      const result=await api('/session');if(generation!==epoch)return;
      if(result.user.status!=='approved'){
        clearAccess(result.user.email+'\n'+(result.user.status==='rejected'?'접근이 차단됐습니다. 관리자에게 문의해 주세요.':'관리자 승인 대기 중입니다. 승인되면 자동으로 열립니다.'));return;
      }
      const current=await api('/state');if(generation!==epoch||app.busy())return;
      const state=current.state||app.initial();app.validate(state);user=result.user;
      if(!app.isOpen()){app.open(user,state);revision=current.revision;googleArea.hidden=true;sessionActions.hidden=true;document.getElementById('sync-state').textContent='공동 저장 연결됨';}
      else if(current.revision>revision){revision=current.revision;app.receive(state);document.getElementById('sync-state').textContent='최신 내용 반영';}
    }catch(e){if(generation!==epoch)return;if(e.status===401){clearAccess(e.message,true);await loginButton().catch(err=>tell(err.message))}else if(e.status===403){clearAccess(e.message)}else{if(!app.isOpen())tell(e.message);else document.getElementById('sync-state').textContent='동기화 연결 확인 필요';}}
    finally{refreshing=false}
  }
  window.WeddingCloud={
    async save(state){
      if(!token||!user||user.status!=='approved')throw new Error('승인된 계정으로 로그인해 주세요.');
      const generation=epoch,baseRevision=revision;
      try{const result=await api('/state',{method:'PUT',body:JSON.stringify({state,revision:baseRevision})});if(generation!==epoch)throw new Error('로그인 상태가 변경됐습니다.');revision=result.revision;return result}
      catch(e){
        if(generation!==epoch)throw e;
        if(e.status===401||e.status===403){clearAccess(e.message,e.status===401)}
        else if(e.status===409){try{const current=await api('/state');if(generation===epoch){app.validate(current.state);revision=current.revision;e.current=current}}catch(inner){if(inner.status===401||inner.status===403)clearAccess(inner.message,inner.status===401)}}
        throw e;
      }
    }
  };
  async function logout(){
    const prior=token;clearAccess('로그아웃했습니다.',true);

    if(prior)await api('/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+prior}}).catch(()=>{});
    await loginButton().catch(e=>tell(e.message));
  }
  async function members(){
    if(!user?.isAdmin)return;const generation=epoch;const dialog=document.getElementById('access-dialog'),body=document.getElementById('access-dialog-body');body.textContent='신청 목록을 불러오고 있습니다.';if(!dialog.open)dialog.showModal();
    try{const result=await api('/members');if(generation!==epoch)return;body.innerHTML='<p class="muted smalltext">승인하면 실제 데이터를 조회·수정할 수 있습니다. 친구의 양식 검토에는 데모 주소를 공유하세요.</p>'+result.members.map(m=>`<div class="member-item"><strong>${escape(m.name)}</strong><div class="member-email">${escape(m.email)}</div><span class="badge ${m.isAdmin||m.status==='approved'?'green':m.status==='pending'?'yellow':'red'}">${m.isAdmin?'관리자':m.status==='approved'?'승인됨':m.status==='pending'?'승인 대기':'차단됨'}</span>${m.isAdmin?'':`<div class="actions">${m.status!=='approved'?`<button type="button" class="primary small" data-auth-action="approve" data-uid="${escape(m.uid)}">승인</button>`:''}${m.status!=='rejected'?`<button type="button" class="danger small" data-auth-action="reject" data-uid="${escape(m.uid)}">${m.status==='approved'?'승인 취소 · 차단':'승인 거절'}</button>`:''}</div>`}</div>`).join('')}
    catch(e){if(generation===epoch)body.textContent=e.message}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-auth-action]');if(!button)return;const action=button.dataset.authAction;
    try{
      if(action==='logout')await logout();
      if(action==='refresh')await refresh();
      if(action==='members')await members();
      if(action==='close-members')document.getElementById('access-dialog').close();
      if(action==='failed-draft')app.downloadFailed();
      if(action==='approve'||action==='reject'){
        if(action==='reject'&&!window.confirm('이 계정의 실제 데이터 접근을 차단할까요?'))return;
        button.disabled=true;await api('/members/'+encodeURIComponent(button.dataset.uid),{method:'PATCH',body:JSON.stringify({status:action==='approve'?'approved':'rejected'})});await members();app.notify(action==='approve'?'사용자를 승인했습니다.':'접근을 차단했습니다.');
      }
    }catch(e){app.notify(e.message);button.disabled=false}
  });
  async function start(){
    const configured=String(window.WEDDING_CONFIG?.apiUrl||'').trim();
    if(!configured){googleArea.innerHTML='<button type="button" disabled>아이디로 로그인 · 연결 준비 중</button>';tell('로그인·공동 저장 연결 설정이 아직 완료되지 않았습니다.\n게스트 데모는 지금 둘러볼 수 있습니다.');return}
    try{const parsed=new URL(configured);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error();apiUrl=configured.replace(/\/$/,'')}catch{tell('로그인 서버 주소가 올바르지 않습니다.');return}
    sessionKey='wedding-cloud-session:'+apiUrl;
    token=restoreToken();
    try{const config=await api('/config');authReady=config.authMode==='password';if(!authReady)throw new Error('서버 코드를 최신 버전으로 교체해 주세요.');if(token)await refresh();else await loginButton()}
    catch(e){tell(e.message);googleArea.hidden=true;}
  }
  window.addEventListener('storage',event=>{
    if(event.key===sessionKey&&event.oldValue&&event.oldValue===token&&event.newValue!==token){clearAccess('로그인 상태가 다른 탭에서 변경됐습니다.');token='';try{sessionStorage.removeItem(sessionKey)}catch{}loginButton().catch(e=>tell(e.message));}
  });
  window.addEventListener('pagehide',()=>{epoch++;app.lock();user=null;revision=-1});
  window.addEventListener('pageshow',e=>{if(e.persisted&&token)refresh()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)refresh()});
  setInterval(()=>{if(token&&!document.hidden)refresh()},15000);
  start();
})();
