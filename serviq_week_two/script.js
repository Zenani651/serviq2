const SUBS={HR:["Payslip Issue","Staff Complaint","Leave Request","Benefits Query","Recruitment Request","Other"],IT:["Password Reset","Software Install","Hardware Fault","Network Issue","Access Request","Email Issue","Other"],Finance:["Invoice Query","Reimbursement","Budget Approval","Payroll Query","Expense Report","Other"],Operations:["Maintenance Request","Logistics Support","Facility Issue","Supply Request","Vendor Issue","Other"]};

const RESPONSE_TEMPLATES={
  HR:{
    "Payslip Issue":"Hello {name},\n\nThank you for raising your payslip concern. I have reviewed your record for {department}. Your {sub} request (Ticket {id}) is being processed.\n\nNext steps: Our HR team will verify deductions and update you within 24 hours.\n\nBest regards,\nHR Team",
    "Leave Request":"Dear {name},\n\nYour leave request has been received and logged under {id}.\n\nWe will review your leave balance and manager approval. You will receive confirmation shortly.\n\nKind regards,\nHR Team",
    "Staff Complaint":"Dear {name},\n\nThank you for bringing this matter to our attention. Your complaint has been logged confidentially.\n\nOur HR team will investigate and reach out for a private discussion.\n\nRegards,\nHR Team",
    "default":"Hello {name},\n\nThank you for contacting HR regarding {sub}. Your ticket {id} has been received.\n\nWe are reviewing your request and will respond with an update soon.\n\nBest,\nHR Team"
  },
  IT:{
    "Password Reset":"Hi {name},\n\nYour password reset request ({id}) has been received.\n\nWe have initiated a reset for your account. Please check your email for a secure reset link valid for 15 minutes.\n\nIf you still cannot access Teams, reply to this ticket.\n\nThanks,\nIT Support",
    "Email Issue":"Hi {name},\n\nI understand your email has been compromised – that is urgent for us.\n\nWe have locked the account temporarily, forced a password reset, and are scanning for forwarding rules. Your ticket {id} is now Critical priority.\n\nYou will receive a new temporary password via your manager.\n\nStay safe,\nIT Security",
    "default":"Hi {name},\n\nThanks for reporting {sub}. Ticket {id} is logged in our IT queue.\n\nOur team will troubleshoot and update you. Please keep your device online.\n\nRegards,\nIT Support"
  },
  Finance:{
    "Invoice Query":"Hello {name},\n\nYour invoice query ({id}) for {department} has been received.\n\nWe are checking INV status with Finance. Approval typically takes 24-48h.\n\nWe will update you once cleared.\n\nThanks,\nFinance Team",
    "default":"Hello {name},\n\nThank you for contacting Finance regarding {sub}. Ticket {id} is under review.\n\nOur team will verify records and respond with resolution.\n\nBest,\nFinance"
  },
  Operations:{
    "Facility Issue":"Hi {name},\n\nThanks for reporting the facility issue. Ticket {id} has been assigned to our maintenance team.\n\nA technician will be dispatched to {department} today.\n\nRegards,\nOperations",
    "default":"Hi {name},\n\nYour Operations request ({sub}) – {id} – is logged.\n\nWe have assigned a team member and will provide an ETA shortly.\n\nThanks,\nOperations Team"
  }
};

const TONE_MODIFIERS={
  formal:{prefix:"Dear {name},\n\n", suffix:"\n\nKind regards,\n{team} Team", transform:(txt)=>txt.replace(/Hi |Hello /g,'Dear ').replace(/Thanks,/g,'Thank you,')},
  friendly:{prefix:"Hi {name}! 😊\n\n", suffix:"\n\nCheers,\n{team} Team", transform:(txt)=>txt.replace(/Dear /g,'Hi ').replace(/Thank you/g,'Thanks so much')},
  urgent:{prefix:"URGENT – {name}, action taken\n\n", suffix:"\n\nThis is priority – please confirm receipt.\n{team} Team", transform:(txt)=> "⚠️ PRIORITY RESPONSE\n\n" + txt.toUpperCase().split('\n').slice(0,3).join('\n') + "\n\n" + txt}
};

const PRI={critical:{label:'Critical',cls:'crit',hours:2},high:{label:'High',cls:'high',hours:8},medium:{label:'Medium',cls:'med',hours:24},low:{label:'Low',cls:'low',hours:72}};
const TEAMS=["HR","IT","Finance","Operations"];
let tickets=JSON.parse(localStorage.getItem('serviq_tickets')||'null')||[
// Each ticket can have responses: [{from, message, tone, timestamp}]
{id:'SRV-2026-1001',name:'Nthabiseng',surname:'Molefe',department:'HR',category:'HR',sub:'Payslip Issue',title:'HR: Payslip Issue',description:'My October payslip shows incorrect deduction, please review HR records.',priority:'high',status:'open',created:Date.now()-1000*60*60*5,requesterEmail:'requester@serviq.com'},
{id:'SRV-2026-2001',name:'Thabo',surname:'Dlamini',department:'IT',category:'IT',sub:'Password Reset',title:'IT: Password Reset',description:'Cannot access Teams - password expired.',priority:'critical',status:'open',created:Date.now()-1000*60*60*2,requesterEmail:'thabo@serviq.com'},
{id:'SRV-2026-3001',name:'Lerato',surname:'Khumalo',department:'Finance',category:'Finance',sub:'Invoice Query',title:'Finance: Invoice Query',description:'Invoice INV-882 not approved yet for payment.',priority:'medium',status:'open',created:Date.now()-1000*60*60*20,requesterEmail:'lerato@serviq.com'},
];
let session=JSON.parse(localStorage.getItem('serviq_session')||'null');
function save(){localStorage.setItem('serviq_tickets',JSON.stringify(tickets));localStorage.setItem('serviq_session',JSON.stringify(session));renderAll();}
function esc(s){return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function rel(ts){const d=Date.now()-ts; if(d<60000) return 'just now'; if(d<3600000) return Math.floor(d/60000)+'m ago'; if(d<86400000) return Math.floor(d/3600000)+'h ago'; return Math.floor(d/86400000)+'d ago';}
function due(t){if(t.status==='resolved') return 'Resolved '+rel(t.resolvedAt||Date.now()); const h=PRI[t.priority]?.hours||24; const dueTs=t.created+h*36e5; if(Date.now()>dueTs) return 'Overdue by '+Math.round((Date.now()-dueTs)/36e5)+'h'; return 'Due in '+Math.round((dueTs-Date.now())/36e5)+'h';}
function goView(n){
  if(n==='myqueue' && session && session.role==='receiver'){alert('⛔ Admins cannot view My Tickets. Admins view ALL tickets in Triage Desk.'); n='receiver';}
  if(n==='receiver' && session && session.role!=='receiver'){alert('⛔ Access denied. Only Admin can view Triage Desk.'); n='myqueue';}
  if(n==='create' && session && session.role==='receiver'){alert('⛔ Admins cannot create tickets.'); n='receiver';}
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); 
  const target=document.getElementById('v-'+n); if(target) target.classList.add('active');
  window.scrollTo(0,0); renderNav();
}
function renderNav(){
  const nav=document.getElementById('navlinks'); const ua=document.getElementById('userarea');
  if(!session){nav.innerHTML='<button class="nbtn" data-go="landing">Home</button><button class="nbtn" data-go="login">Login</button>'; ua.innerHTML=''; return;}
  const isRec=session.role==='receiver';
  nav.innerHTML=isRec?'<button class="nbtn" data-go="landing">Home</button><button class="nbtn active" data-go="receiver">Triage Desk (Admin sees ALL)</button>':'<button class="nbtn" data-go="landing">Home</button><button class="nbtn active" data-go="myqueue">My Tickets (Only Yours)</button><button class="nbtn lime" data-go="create">+ New Ticket</button>';
  ua.innerHTML='<div class="userchip"><div class="avatar">'+esc((session.name||'U')[0])+'</div><div style="line-height:1.1"><b style="font-size:.85rem">'+esc(session.name)+'</b><br><small style="color:var(--muted)">'+esc(session.role)+' • '+esc(session.email)+'</small></div><button class="nbtn" id="signout">Sign out</button></div>';
}
function updateSubs(){
  const cat=document.getElementById('r-cat').value; const sel=document.getElementById('r-sub');
  if(!SUBS[cat]){sel.innerHTML='<option value="">Select category first</option>'; return;}
  sel.innerHTML=SUBS[cat].map(s=>'<option>'+esc(s)+'</option>').join('');
  autoTitle();
}
function autoTitle(){
  const cat=document.getElementById('r-cat').value; const sub=document.getElementById('r-sub').value;
  const titleInput=document.getElementById('r-title'); const titleLabel=document.getElementById('title-label');
  if(sub==='Other'){
    titleInput.value=''; titleInput.placeholder='Please specify your issue title';
    titleLabel.textContent='If Other, please specify the title *'; titleLabel.style.color='#B3261E'; titleLabel.style.fontWeight='700';
  } else if(cat&&sub){
    titleInput.value=cat+': '+sub; titleInput.placeholder='e.g. '+cat+': '+sub;
    titleLabel.textContent='Ticket Title — auto-filled from sub-category, editable *'; titleLabel.style.color=''; titleLabel.style.fontWeight='';
  }
  renderPreview();
}
function renderPreview(){
  const d={name:document.getElementById('r-name').value||'Name',surname:document.getElementById('r-surname').value||'Surname',dept:document.getElementById('r-dept').value,cat:document.getElementById('r-cat').value||'Category',sub:document.getElementById('r-sub').value||'Sub-category',title:document.getElementById('r-title').value||'Title will auto-fill',desc:document.getElementById('r-desc').value||'Description...',};
  document.getElementById('livePreview').innerHTML='<div><b>Requester Name</b>: '+esc(d.name)+' '+esc(d.surname)+'</div><div><b>Department</b>: '+esc(d.dept)+'</div><div><b>Category</b>: '+esc(d.cat)+'</div><div><b>Sub-category</b>: '+esc(d.sub)+'</div><div><b>Title</b>: '+esc(d.title)+'</div><div><b>Description</b><br>'+esc(d.desc)+'</div>';
}
function renderMy(){
  const q=(document.getElementById('my-search').value||'').toLowerCase(); const st=document.getElementById('my-status').value;
  const listEl=document.getElementById('my-list');
  if(!session){listEl.innerHTML='<div class="card"><h3>🔒 Please sign in</h3><p class="hint">Your tickets are private to your work email.</p></div>';return;}
  let list=tickets.filter(t=>t.requesterEmail && t.requesterEmail.toLowerCase().trim()===session.email.toLowerCase().trim());
  if(q) list=list.filter(t=>(t.title+t.description+t.category+t.sub).toLowerCase().includes(q));
  if(st!=='all') list=list.filter(t=>t.status===st);
  list=list.sort((a,b)=>b.created-a.created);
  if(!list.length){listEl.innerHTML='<div class="card"><h3>Private to '+esc(session.email)+' • 0 tickets</h3><p class="hint">Only YOU can see your tickets. Other requestors cannot see yours.</p></div>';return;}
  listEl.innerHTML='<div class="card" style="background:var(--accent-soft);border:1px solid var(--accent)"><b>🔒 Private to '+esc(session.email)+' • '+list.length+' ticket(s)</b><span class="hint"> — Only you can see these • Now includes Admin responses (Week 2)</span></div>'+list.map(t=>{
    const responses = t.responses||[];
    const respHtml = responses.length ? '<div class="response-history"><b>💬 Responses from Receiver/Admin</b>' + responses.map(r=>'<div class="response-item admin"><div class="meta">'+esc(r.from)+' • '+rel(r.timestamp)+' • <span class="badge tone-'+esc(r.tone)+'">'+esc(r.tone)+'</span></div><div style="white-space:pre-wrap">'+esc(r.message)+'</div></div>').join('') + '</div>' : '<div class="response-history"><span class="hint">No response yet from Admin. Admin will respond via AI Response Generator.</span></div>';
    return '<div class="ticket"><div class="line1"><span class="mono">'+esc(t.id)+'</span><span>'+rel(t.created)+'</span><span class="badge '+t.category.toLowerCase()+'">'+esc(t.category)+'</span><span class="badge pri '+PRI[t.priority].cls+'">Priority set by Admin: '+esc(t.priority)+'</span><span class="badge">'+esc(t.status)+'</span></div><h3 style="margin:4px 0">'+esc(t.title)+'</h3><p class="hint">'+esc(t.description)+'</p><div class="hint">'+esc(t.name)+' '+esc(t.surname)+' • '+esc(t.department)+' • '+due(t)+'</div>'+respHtml+'</div>';
  }).join('');
}
function renderAdmin(){
  if(session && session.role!=='receiver'){document.getElementById('adm-groups').innerHTML='<div class="card"><h3>⛔ Access Denied</h3><p class="hint">Only Admin can view all tickets.</p></div>';return;}
  const q=(document.getElementById('adm-search').value||'').toLowerCase(); const st=document.getElementById('adm-status').value; const pr=document.getElementById('adm-pri').value;
  let list=[...tickets];
  if(q) list=list.filter(t=>(t.title+t.description+t.name+t.category+t.sub+(t.requesterEmail||'')).toLowerCase().includes(q));
  if(st==='active') list=list.filter(t=>t.status!=='resolved'); else if(st!=='all') list=list.filter(t=>t.status===st);
  if(pr!=='all') list=list.filter(t=>t.priority===pr);
  let html='<div class="card" style="background:var(--accent-soft);border:1px solid var(--accent)"><b>🔓 Admin View: ALL Tickets</b><span class="hint"> • Showing '+list.length+' of '+tickets.length+' total</span></div>';
  ['critical','high','medium','low'].forEach(g=>{
    const items=list.filter(t=>t.priority===g).sort((a,b)=>a.created-b.created);
    html+='<div class="group"><div class="ghead '+g+'"><span>'+PRI[g].label+' • '+items.length+'</span><span class="hint">'+PRI[g].hours+'h SLA</span></div><div class="gbody">'+(items.length?items.map(t=>{
      const responses = t.responses||[];
      const respHistory = responses.length ? '<div class="response-history"><b>Previous responses</b>' + responses.map(r=>'<div class="response-item admin"><div class="meta">'+esc(r.from)+' • '+rel(r.timestamp)+' • <span class="badge tone-'+esc(r.tone)+'">'+esc(r.tone)+'</span></div><div style="white-space:pre-wrap">'+esc(r.message)+'</div></div>').join('') + '</div>' : '';
      // AI Response Generator - Week 2
      const genBox = '<div class="response-box"><h4>🤖 AI Response Generator — Week 2</h4><div class="hint">Integrate generative AI • Templates per category • Tone control (formal, friendly, urgent)</div><div class="template-grid"><select class="select" id="tmpl-'+esc(t.id)+'"><option value="auto">Auto (based on category: '+esc(t.category)+'/'+esc(t.sub)+')</option><option value="default">Default template</option>'+Object.keys(RESPONSE_TEMPLATES[t.category]||{}).map(k=>'<option value="'+esc(k)+'">'+esc(k)+'</option>').join('')+'</select><select class="select" id="cat-'+esc(t.id)+'"><option>HR</option><option>IT</option><option>Finance</option><option>Operations</option></select></div><div class="tone-group"><button class="tone-btn formal" data-tone="formal" data-id="'+esc(t.id)+'">Formal</button><button class="tone-btn friendly active" data-tone="friendly" data-id="'+esc(t.id)+'">Friendly</button><button class="tone-btn urgent" data-tone="urgent" data-id="'+esc(t.id)+'">Urgent</button></div><textarea class="ai-response" id="resp-'+esc(t.id)+'" placeholder="AI will generate professional response here... Click Generate"></textarea><div style="display:flex;gap:8px"><button class="nbtn primary" data-act="generate" data-id="'+esc(t.id)+'">✨ Generate AI Response</button><button class="nbtn lime" data-act="send" data-id="'+esc(t.id)+'">Send to Requester →</button></div><div class="hint">Outcome: System now classifies AND responds. Mapped Roles: Service Desk Analyst, AI Intern, Customer Support Analyst</div></div>';
      return '<div class="ticket"><div class="line1"><span class="mono">'+esc(t.id)+'</span><span>'+rel(t.created)+'</span><span class="badge '+t.category.toLowerCase()+'">'+esc(t.category)+'</span><span class="badge pri '+PRI[t.priority].cls+'">'+esc(t.priority)+'</span><span>'+due(t)+'</span><span class="badge" style="background:var(--accent);color:#fff">'+esc(t.requesterEmail)+'</span></div><h3>'+esc(t.title)+'</h3><div class="requester-html"><div><b>Requester Name</b>: '+esc(t.name)+' '+esc(t.surname)+'</div><div><b>Dept</b>: '+esc(t.department)+'</div><div><b>Category/Sub</b>: '+esc(t.category)+' / '+esc(t.sub)+'</div><div><b>Title</b>: '+esc(t.title)+'</div><div><b>Description</b>: '+esc(t.description)+'</div></div><div class="controls"><select data-act="status" data-id="'+esc(t.id)+'"><option value="open" '+(t.status==='open'?'selected':'')+'>Waiting</option><option value="progress" '+(t.status==='progress'?'selected':'')+'>In progress</option><option value="resolved" '+(t.status==='resolved'?'selected':'')+'>Resolved</option></select><select data-act="priority" data-id="'+esc(t.id)+'"><option value="critical" '+(t.priority==='critical'?'selected':'')+'>Critical</option><option value="high" '+(t.priority==='high'?'selected':'')+'>High</option><option value="medium" '+(t.priority==='medium'?'selected':'')+'>Medium</option><option value="low" '+(t.priority==='low'?'selected':'')+'>Low</option></select><select data-act="reroute" data-id="'+esc(t.id)+'"><option value="">Keep in '+esc(t.category)+'</option>'+TEAMS.filter(x=>x!==t.category).map(x=>'<option value="'+x+'">Move to '+x+'</option>').join('')+'</select><button data-act="assign" data-id="'+esc(t.id)+'">'+(t.assignee?'Reassign':'Assign to me')+'</button></div>'+respHistory+genBox+'</div>';
    }).join(''):'<p class="hint">No tickets</p>')+'</div></div>';
  });
  document.getElementById('adm-groups').innerHTML=html;
}
function renderAll(){renderNav(); renderMy(); renderAdmin();}
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]'); if(go){
    const v=go.dataset.go;
    if(v==='requester'){if(!session){goView('login');document.getElementById('email').value='requester@serviq.com';}else goView(session.role==='receiver'?'receiver':'create');}
    else if(v==='receiver'){if(!session){goView('login');document.getElementById('email').value='admin@serviq.com';}else goView('receiver');}
    else goView(v); return;
  }
  if(e.target.id==='signout'){session=null;save();goView('landing');}
  if(e.target.id==='brand'){goView('landing');}
  if(e.target.dataset.fill){document.getElementById('email').value=e.target.dataset.fill; document.getElementById('password').value='demo123';}
  if(e.target.id==='resetDemo'){localStorage.removeItem('serviq_tickets');location.reload();}
});
document.getElementById('r-cat').addEventListener('change',updateSubs);
document.getElementById('r-sub').addEventListener('change',autoTitle);
['r-name','r-surname','r-dept','r-title','r-desc'].forEach(id=>{const el=document.getElementById(id); if(el){el.addEventListener('input',renderPreview); el.addEventListener('change',renderPreview);}});
document.getElementById('loginBtn').addEventListener('click',()=>{
  const email=document.getElementById('email').value.trim(); const pass=document.getElementById('password').value.trim();
  if(!email||!pass){alert('Enter work email and password');return;}
  const isRec=email.toLowerCase().includes('admin')||email.toLowerCase().includes('receiver')||email.toLowerCase().includes('triage');
  const name=email.split('@')[0].replace(/[._]/g,' ');
  session={email:email.toLowerCase(),name:name.charAt(0).toUpperCase()+name.slice(1),role:isRec?'receiver':'requester'};
  save(); goView(isRec?'receiver':'create');
});
document.getElementById('submitTicket').addEventListener('click',()=>{
  const name=document.getElementById('r-name').value.trim(); const surname=document.getElementById('r-surname').value.trim();
  const dept=document.getElementById('r-dept').value; const cat=document.getElementById('r-cat').value; const sub=document.getElementById('r-sub').value;
  const title=document.getElementById('r-title').value.trim(); const desc=document.getElementById('r-desc').value.trim();
  const pri='medium';
  if(!name||!surname||!cat||!sub||!title||!desc){alert('Fill all required');return;}
  if(sub==='Other' && title.length<5){alert('You selected Other - please specify title');return;}
  const newT={id:'SRV-2026-'+Math.floor(1000+Math.random()*9000),name,surname,department:dept,category:cat,sub,title,description:desc,priority:pri,status:'open',created:Date.now(),requesterEmail:session?session.email:'requester@serviq.com'};
  tickets.unshift(newT); save(); alert('Ticket '+newT.id+' created! Only YOU will see it in My Tickets. Admin sees ALL.'); goView('myqueue');
});
['my-search','adm-search'].forEach(id=>{document.getElementById(id).addEventListener('input',renderAll);});
['my-status','adm-status','adm-pri'].forEach(id=>{document.getElementById(id).addEventListener('change',renderAll);});
document.getElementById('adm-groups').addEventListener('change',e=>{
  const sel=e.target; const id=sel.dataset.id; const t=tickets.find(x=>x.id===id); if(!t) return;
  if(sel.dataset.act==='status'){t.status=sel.value; if(sel.value==='resolved') t.resolvedAt=Date.now();}
  if(sel.dataset.act==='priority'){t.priority=sel.value;}
  if(sel.dataset.act==='reroute'&&sel.value){t.category=sel.value; t.assignee=null; if(t.status==='progress') t.status='open';}
  save();
});

document.getElementById('adm-groups').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const id=b.dataset.id; const t=tickets.find(x=>x.id===id); if(!t) return;
  if(b.dataset.act==='assign'){t.assignee=session?session.name:'Admin'; if(t.status==='open') t.status='progress'; save();}
  if(b.dataset.act==='generate'){
    const tmplSel=document.getElementById('tmpl-'+id);
    const respEl=document.getElementById('resp-'+id);
    const toneBtn = document.querySelector('.tone-btn.active[data-id="'+id+'"]');
    const tone = toneBtn ? toneBtn.dataset.tone : 'friendly';
    let templateKey = tmplSel ? tmplSel.value : 'auto';
    if(templateKey==='auto') templateKey = t.sub;
    let base = (RESPONSE_TEMPLATES[t.category] && RESPONSE_TEMPLATES[t.category][templateKey]) || (RESPONSE_TEMPLATES[t.category] && RESPONSE_TEMPLATES[t.category]['default']) || RESPONSE_TEMPLATES['IT']['default'];
    // Replace placeholders - generative AI simulation
    let msg = base.replace(/{name}/g, t.name).replace(/{department}/g, t.department).replace(/{sub}/g, t.sub).replace(/{id}/g, t.id).replace(/{team}/g, t.category);
    // Apply tone
    if(tone==='formal'){ msg = 'Dear '+t.name+',\n\n' + msg.replace(/Hi |Hello /g,'').trim() + '\n\nKind regards,\n'+t.category+' Team'; msg = msg.replace(/😊/g,''); }
    else if(tone==='friendly'){ msg = 'Hi '+t.name+'! 😊\n\n' + msg.replace(/Dear |Hello /g,'').trim() + '\n\nCheers,\n'+t.category+' Team'; }
    else if(tone==='urgent'){ msg = '⚠️ URGENT: '+t.name+', immediate action taken on '+t.id+'\n\n' + msg + '\n\nPlease confirm receipt ASAP.\n'+t.category+' Team - Priority '+t.priority.toUpperCase(); }
    respEl.value = msg;
  }
  if(b.dataset.act==='send'){
    const respEl=document.getElementById('resp-'+id);
    const toneBtn = document.querySelector('.tone-btn.active[data-id="'+id+'"]');
    const tone = toneBtn ? toneBtn.dataset.tone : 'friendly';
    const message = respEl.value.trim();
    if(!message){alert('Generate or type a response first'); return;}
    if(!t.responses) t.responses=[];
    t.responses.push({from: session?session.name:'Admin', message, tone, timestamp: Date.now()});
    t.status='progress';
    if(t.priority==='critical' && tone==='urgent') t.priority='high';
    save();
    alert('Response sent to '+t.name+' ('+t.requesterEmail+') via '+tone+' tone. Requester will see it in My Tickets.');
  }
  if(b.dataset.tone){
    document.querySelectorAll('.tone-btn[data-id="'+id+'"]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }
});

renderAll(); renderPreview(); goView('landing');
