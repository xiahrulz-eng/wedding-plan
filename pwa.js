(() => {
 let promptEvent=null;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const buttons=[];
 const dialog=document.createElement('dialog');dialog.style.cssText='max-width:420px;width:calc(100% - 40px);border:1px solid #eadfe8;border-radius:20px;padding:24px;color:#343b49';
 dialog.innerHTML='<h2>휴대폰에 설치하기</h2><p>아이폰: Safari에서 공유 버튼 → 홈 화면에 추가 → 추가</p><p>안드로이드: Chrome 메뉴(⋮) → 앱 설치 또는 홈 화면에 추가</p><p style="font-size:14px;color:#747985">설치 후 로그인 상태 유지에 체크하면 다음에도 편하게 이용할 수 있어요.</p><form method="dialog"><button>닫기</button></form>';document.body.append(dialog);
 for(const container of [document.querySelector('.auth-card'),document.querySelector('.account-strip .actions')]){
  if(!container)continue;const button=document.createElement('button');button.type='button';button.textContent='휴대폰 앱 설치';button.style.cssText='margin-top:12px';button.hidden=standalone();container.append(button);buttons.push(button);
  button.onclick=async()=>{if(promptEvent){const pending=promptEvent;promptEvent=null;try{await pending.prompt();await pending.userChoice}catch{dialog.showModal()}}else dialog.showModal()};
 }
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event});
 window.addEventListener('appinstalled',()=>{promptEvent=null;buttons.forEach(b=>b.hidden=true);if(dialog.open)dialog.close()});
 if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{});
})();
