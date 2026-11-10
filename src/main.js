(() => {
"use strict";
const $ = s => document.querySelector(s);
const W = 960, M = 256, TAU = Math.PI * 2;
const canvas = $("#art"), ctx = canvas.getContext("2d", {alpha:false});
const maskCanvas = document.createElement("canvas");
maskCanvas.width = maskCanvas.height = M;
const mc = maskCanvas.getContext("2d", {willReadFrequently:true});
const DEFAULT = {mode:"spiral",shape:"hand",hover:"repel",color:"#d8c25d",density:34,amplitude:11,pitch:19,speed:1,contrast:1,hoverRadius:160,hoverForce:42,invert:false,playing:true,text:"LINE"};
const settings = {...DEFAULT};
let mask = new Float32Array(M*M), source = null, time = 0, last = 0, tick = 0, lastNotice = 0;
const mouse = {x:480,y:480,tx:480,ty:480,inside:false,weight:0};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), lerp=(a,b,t)=>a+(b-a)*t;
const num=v=>Number(v).toFixed(2);
function generateSource(){
 mc.clearRect(0,0,M,M);
 mc.save(); mc.scale(M/800,M/800); mc.fillStyle="#fff";
 if(source) {
  const image=source.element, w=image.videoWidth||image.naturalWidth, h=image.videoHeight||image.naturalHeight;
  if(w&&h){const r=Math.min(690/w,690/h);try{mc.drawImage(image,(800-w*r)/2,(800-h*r)/2,w*r,h*r)}catch(e){console.warn(e)}}
 } else if(settings.shape==="hand"){
  mc.fill(new Path2D("M 295 755 L 293 619 C 290 579 254 531 219 482 C 204 460 211 437 231 429 C 253 418 270 441 285 457 L 346 513 L 340 241 C 340 215 355 202 374 205 C 391 206 401 223 402 249 L 412 463 L 417 188 C 418 159 434 144 453 147 C 477 150 490 167 490 195 L 491 464 L 506 211 C 507 184 522 173 540 175 C 562 179 574 197 570 222 L 558 481 L 584 272 C 587 249 598 238 618 241 C 636 244 645 260 641 283 L 614 560 C 608 645 622 704 604 755 Z"));
 } else if(settings.shape==="butterfly"){
  const p=new Path2D("M400 487 C347 423 263 286 204 292 C157 300 164 383 245 453 C188 441 144 478 157 524 C174 578 279 613 400 528 Z");
  mc.fill(p);mc.save();mc.translate(800,0);mc.scale(-1,1);mc.fill(p);mc.restore();
  mc.fillRect(389,414,22,166);
  mc.strokeStyle="#fff";mc.lineWidth=5;mc.beginPath();mc.moveTo(395,424);mc.quadraticCurveTo(355,368,356,344);mc.moveTo(406,424);mc.quadraticCurveTo(444,368,445,344);mc.stroke();
 } else if(settings.shape==="ginkgo"){
  mc.fill(new Path2D("M401 568 C351 515 289 525 246 467 C218 426 217 374 257 335 C276 304 313 284 343 302 C343 259 366 234 401 232 C435 229 455 255 462 294 C506 261 542 289 564 315 C613 336 615 385 588 421 C616 455 582 499 540 511 C489 530 442 532 401 568 Z"));
  mc.lineWidth=11;mc.lineCap="round";mc.strokeStyle="#fff";mc.beginPath();mc.moveTo(402,563);mc.quadraticCurveTo(400,675,373,750);mc.stroke();
 } else if(settings.shape==="sphere"){
  const g=mc.createRadialGradient(344,323,17,401,434,247);g.addColorStop(0,"#fff");g.addColorStop(.5,"#ddd");g.addColorStop(1,"#050505");mc.fillStyle=g;mc.beginPath();mc.arc(402,431,240,0,TAU);mc.fill();
 } else {
  const text=settings.text.trim()||"LINE"; const len=[...text].length;const size=Math.min(190,610/Math.max(1,len*.78));
  mc.font="800 "+size+"px system-ui, 'PingFang SC', sans-serif";mc.textAlign="center";mc.textBaseline="middle";mc.fillText(text,401,430,620);
 }
 mc.restore();
 const pixels=mc.getImageData(0,0,M,M).data;
 let byAlpha=false;
 if(source&&source.type==="image"){
  let count=0;
  for(let y=48;y<208;y+=4)for(let x=48;x<208;x+=4)if(pixels[(y*M+x)*4+3]<225)count++;
  byAlpha=count>60;
 }
 const next=new Float32Array(M*M);
 for(let i=0;i<next.length;i++){
  const p=i*4, a=pixels[p+3]/255, lum=(pixels[p]*.213+pixels[p+1]*.715+pixels[p+2]*.072)/255;
  let v=source?(byAlpha?a:(settings.invert?lum:1-lum)*a):a;
  if(source&&!byAlpha)v=clamp((v-.025)*1.4,0,1);
  next[i]=Math.pow(clamp(v,0,1),settings.contrast);
 }
 mask=next;
}
function sample(x,y){
 const xx=clamp(x/W*(M-2),0,M-2),yy=clamp(y/W*(M-2),0,M-2);
 const ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy;
 return lerp(lerp(mask[iy*M+ix],mask[iy*M+ix+1],fx),lerp(mask[(iy+1)*M+ix],mask[(iy+1)*M+ix+1],fx),fy);
}
function force(x,y) {
 if(settings.hover==="off"||mouse.weight<.005)return [x,y];
 const dx=x-mouse.x,dy=y-mouse.y,d=Math.hypot(dx,dy);
 const a=Math.max(0,1-d/settings.hoverRadius);
 if(!a)return [x,y];
 const sign=settings.hover==="attract"?-1:1;
 const f=sign*a*a*settings.hoverForce*mouse.weight/Math.max(d,1);
 return [x+dx*f,y+dy*f];
}
function geometry(t,out){
 const phase=t*settings.speed*2.2;
 if(settings.mode==="spiral"||settings.mode==="wave"){
  for(let row=0;row<settings.density;row++){
   const y=175+row*615/Math.max(1,settings.density-1),points=[];
   for(let x=45;x<=915;x+=2.75){
    const m=sample(x,y),a=x/settings.pitch*TAU-phase;
    let xx=x,yy=y;
    if(settings.mode==="spiral"){xx+=m*settings.amplitude*(Math.cos(a)-1)*.67;yy+=m*settings.amplitude*Math.sin(a)}
    else{yy+=m*settings.amplitude*Math.sin(a)*1.65;xx+=m*settings.amplitude*Math.cos(a*.5)*.12}
    points.push(force(xx,yy));
   }
   out.path(points);
  }
 }else{
  const cols=clamp(Math.round(settings.density*1.65),18,105),rows=Math.round(cols*.85);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=100+i*760/Math.max(1,cols-1),y=115+j*730/Math.max(1,rows-1),m=sample(x,y);
   if(m<.06)continue;
   const [xx,yy]=force(x,y),opacity=clamp(.2+m*.87,0,1);
   if(settings.mode==="dots"){out.dot(xx,yy,Math.max(.5,(1+m*4.4)*(.90+.12*Math.sin(phase+x*.019+y*.017))*(1+settings.amplitude/80)),opacity)}
   else out.stroke(xx,yy,(2+m*13)*(1+settings.amplitude/65),.55*Math.sin(x/(settings.pitch*1.6)+y/35-phase),opacity);
  }
 }
}
function paint(target,w,h,t){
 target.save();target.setTransform(w/W,0,0,h/W,0,0);
 target.fillStyle="#0b1113";target.fillRect(0,0,W,W);
 target.strokeStyle="#152022";target.lineWidth=1;
 for(const k of [85,480,875]){target.beginPath();target.moveTo(k,0);target.lineTo(k,W);target.moveTo(0,k);target.lineTo(W,k);target.stroke()}
 target.strokeStyle=target.fillStyle=settings.color;target.lineWidth=1.1;target.lineJoin=target.lineCap="round";
 geometry(t,{
  path(points){if(!points.length)return;target.globalAlpha=.96;target.beginPath();target.moveTo(...points[0]);for(let i=1;i<points.length;i++)target.lineTo(...points[i]);target.stroke()},
  dot(x,y,r,alpha){target.globalAlpha=alpha;target.beginPath();target.arc(x,y,r,0,TAU);target.fill()},
  stroke(x,y,len,angle,alpha){target.globalAlpha=alpha;const dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2;target.beginPath();target.moveTo(x-dx,y-dy);target.lineTo(x+dx,y+dy);target.stroke()}
 });target.restore();
}
function resize(){
 const rect=canvas.getBoundingClientRect(),size=Math.max(1,Math.round(rect.width*Math.min(devicePixelRatio||1,2)));
 if(canvas.width!==size){canvas.width=size;canvas.height=size}
}
function animate(now){
 const dt=last?clamp((now-last)/1000,0,.05):0;last=now;tick++;
 if(settings.playing)time+=dt;
 mouse.x=lerp(mouse.x,mouse.tx,.19);mouse.y=lerp(mouse.y,mouse.ty,.19);
 mouse.weight=lerp(mouse.weight,mouse.inside&&settings.hover!=="off"?1:0,.11);
 if(source&&source.type==="video"&&settings.playing&&tick%3===0)generateSource();
 paint(ctx,canvas.width,canvas.height,time);requestAnimationFrame(animate);
}
const status=$('#fileStatus');
function setStatus(s){status.textContent=s}
function notice(s){$("#notice").textContent=s;lastNotice=Date.now();setTimeout(()=>{if(Date.now()-lastNotice>=1900)$("#notice").textContent=""},2100)}
function active(group,attr,key){
 document.querySelectorAll(group+" button["+attr+"]").forEach(btn=>{
  const is=btn.dataset[key]===settings[key];btn.classList.toggle("active",is);btn.setAttribute("aria-pressed",String(is));
 });
}
function selectGroup(group,attr,key,update){
 document.querySelectorAll(group+" button["+attr+"]").forEach(btn=>btn.addEventListener("click",()=>{
  settings[key]=btn.dataset[key];active(group,attr,key);if(update)update();
 }));
}
selectGroup("#modeButtons","data-mode","mode");
selectGroup("#shapeButtons","data-shape","shape",()=>{
 clearSource();
 $("#textEntry").hidden=settings.shape!=="text";
 generateSource();
});
selectGroup("#hoverButtons","data-hover","hover");
selectGroup("#colorButtons","data-color","color");
function bindRange(key){
 const input=$("#"+key),output=$("#"+key+"Value");
 input.addEventListener("input",()=>{
  settings[key]=Number(input.value);output.textContent=(key==="speed"||key==="contrast")?settings[key].toFixed(1):String(settings[key]);
  if(key==="contrast")generateSource();
 });
}
["density","amplitude","pitch","speed","contrast","hoverRadius","hoverForce"].forEach(bindRange);
$("#invert").addEventListener("change",e=>{settings.invert=e.target.checked;generateSource()});
$("#customText").addEventListener("input",e=>{settings.text=e.target.value;generateSource()});
function clearSource(){
 if(source){if(source.type==="video"){source.element.pause();source.element.removeAttribute("src");source.element.load()}URL.revokeObjectURL(source.url)}
 source=null;$("#resetSource").hidden=true;setStatus("支持透明 PNG、照片、SVG；本地处理，不上传素材。");
}
function loadFile(file){
 if(!file)return;
 if(!file.type.startsWith("image/")&&!file.type.startsWith("video/")){notice("不支持该文件格式");return}
 clearSource();
 const url=URL.createObjectURL(file);
 if(file.type.startsWith("image/")){
  const image=new Image();
  image.onload=()=>{source={element:image,url,type:"image"};$("#resetSource").hidden=false;setStatus("已导入图片："+file.name);generateSource()};
  image.onerror=()=>{URL.revokeObjectURL(url);notice("图片读取失败")};image.src=url;
 }else{
  const video=document.createElement("video");video.muted=true;video.loop=true;video.playsInline=true;video.preload="auto";
  video.onloadeddata=()=>{source={element:video,url,type:"video"};$("#resetSource").hidden=false;setStatus("已导入视频源："+file.name+"（画面仍由网页实时生成）");generateSource();if(settings.playing)video.play().catch(()=>notice("点击播放以启用视频素材"))};
  video.onerror=()=>{URL.revokeObjectURL(url);notice("视频解码失败")};video.src=url;video.load();
 }
}
$("#fileInput").addEventListener("change",e=>{loadFile(e.target.files[0]);e.target.value=""});
$("#resetSource").addEventListener("click",()=>{clearSource();generateSource()});
const frame=$("#dropZone");
frame.addEventListener("pointermove",event=>{
 const r=canvas.getBoundingClientRect();mouse.tx=clamp((event.clientX-r.left)/r.width*W,0,W);mouse.ty=clamp((event.clientY-r.top)/r.height*W,0,W);mouse.inside=true;
});
frame.addEventListener("pointerenter",()=>mouse.inside=true);
frame.addEventListener("pointerleave",()=>mouse.inside=false);
frame.addEventListener("pointercancel",()=>mouse.inside=false);
["dragenter","dragover"].forEach(type=>frame.addEventListener(type,e=>{e.preventDefault();frame.classList.add("dragging")}));
["dragleave","dragend"].forEach(type=>frame.addEventListener(type,e=>{e.preventDefault();frame.classList.remove("dragging")}));
frame.addEventListener("drop",e=>{e.preventDefault();frame.classList.remove("dragging");loadFile(e.dataTransfer.files[0])});
$("#pauseBtn").addEventListener("click",()=>{
 settings.playing=!settings.playing;
 $("#pauseBtn").innerHTML=settings.playing?"Ⅱ <span>暂停流动</span>":"▶ <span>继续流动</span>";
 $("#pauseBtn").setAttribute("aria-pressed",String(!settings.playing));
 $("#liveReadout").textContent=settings.playing?"● GENERATING":"◌ PAUSED / HOVER ACTIVE";
 if(source&&source.type==="video"){if(settings.playing)source.element.play().catch(()=>{});else source.element.pause()}
});
$("#resetAll").addEventListener("click",()=>{
 clearSource();Object.assign(settings,DEFAULT);
 ["mode","shape","hover","color"].forEach(key=>active("#"+({mode:"modeButtons",shape:"shapeButtons",hover:"hoverButtons",color:"colorButtons"}[key]),"data-"+key,key));
 ["density","amplitude","pitch","speed","contrast","hoverRadius","hoverForce"].forEach(key=>{
  $("#"+key).value=String(settings[key]);$("#"+key+"Value").textContent=key==="speed"||key==="contrast"?"1.0":String(settings[key]);
 });
 $("#invert").checked=false;$("#customText").value=settings.text;$("#textEntry").hidden=true;
 $("#pauseBtn").innerHTML="Ⅱ <span>暂停流动</span>";$("#pauseBtn").setAttribute("aria-pressed","false");
 $("#liveReadout").textContent="● GENERATING";time=0;generateSource();notice("已重置");
});
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("#pngBtn").addEventListener("click",()=>{
 const c=document.createElement("canvas");c.width=c.height=2400;
 paint(c.getContext("2d"),2400,2400,time);
 c.toBlob(blob=>blob?saveBlob(blob,"lineform-"+settings.mode+".png"):notice("PNG 导出失败"),"image/png");
 notice("正在生成 PNG");
});
$("#svgBtn").addEventListener("click",()=>{
 const nodes=[];
 const color=settings.color;
 geometry(time,{
  path(points){nodes.push('<path d="'+points.map((p,i)=>(i?"L":"M")+num(p[0])+","+num(p[1])).join(" ")+'" fill="none" stroke="'+color+'" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>')},
  dot(x,y,r,a){nodes.push('<circle cx="'+num(x)+'" cy="'+num(y)+'" r="'+num(r)+'" fill="'+color+'" opacity="'+num(a)+'"/>')},
  stroke(x,y,len,angle,a){const dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2;nodes.push('<path d="M'+num(x-dx)+','+num(y-dy)+' L'+num(x+dx)+','+num(y+dy)+'" stroke="'+color+'" fill="none" stroke-width="1.1" stroke-linecap="round" opacity="'+num(a)+'"/>')}
 });
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="2400" viewBox="0 0 960 960"><rect width="960" height="960" fill="#0b1113"/>'+nodes.join("")+'</svg>';
 saveBlob(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),"lineform-"+settings.mode+".svg");
 notice("SVG 已导出");
});
window.addEventListener("resize",resize);
window.addEventListener("keydown",e=>{
 if(e.code==="Space"&&!["INPUT","TEXTAREA","BUTTON"].includes(document.activeElement.tagName)){e.preventDefault();$("#pauseBtn").click()}
});
window.addEventListener("beforeunload",()=>{if(source)URL.revokeObjectURL(source.url)});
resize();generateSource();requestAnimationFrame(animate);
})();
