import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=fs.readFileSync('lib/export-video.ts','utf8')+'\nexport {paintKaraokeFrame};';
const context={exports:{},require:()=>({})};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const preview={stageWidth:640,stageHeight:360,fontSizePx:48,lineHeightPx:47,letterSpacingPx:-1.6,maxWidthPx:400,fontWeight:'700',fontStyle:'normal',fontFamily:'Avenir Next',title:{x:18,y:14,fontSize:11.2,fontWeight:'400',fontFamily:'Avenir Next Condensed',letterSpacing:.8,color:'#929292'},logo:{x:590,y:9,width:30,height:30,opacity:.65}};
for(const width of [1920,2560,3840]){
  const texts=[],images=[];
  const ctx={letterSpacing:'0px',fillRect(){},save(){},restore(){},fillText(text,x,y){texts.push({text,x,y,font:this.font})},measureText(text){return {width:text.length*8}},drawImage(...args){images.push(args)}};
  context.exports.paintKaraokeFrame(ctx,width,width*9/16,{time:1,lyrics:[{text:'Test lyric',start:0,width:100}],projectDuration:2,font:'Avenir Next',fontSize:72,lineHeight:.94,textStyle:{bold:true,align:'center',color:'#fff'},textPosition:{x:50,y:50},track:{title:'Song'},showFreeBadge:true,watermarkImage:{naturalWidth:1080,naturalHeight:1080},previewTypography:preview});
  const scale=width/640;
  assert.ok(texts[0].font.includes(`${11.2*scale}px`));
  assert.ok(texts[1].font.includes(`${48*scale}px`));
  assert.equal(images[0][3],30*scale);
  assert.equal(images[0][1],590*scale);
  assert.equal(texts[0].x,18*scale);
}
console.log('PASS: lyric, title and watermark share measured preview scale at 1080, 2K and 4K.');
