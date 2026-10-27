import { useEffect, useId, useRef, useState } from "react";

const choices = {
  classification: ["genitive", "not_genitive", "uncertain"],
  alternation_eligible: ["yes", "no", "uncertain", "not_applicable"],
  animacy: ["human", "animal", "collective", "inanimate", "uncertain"],
  definiteness: ["definite", "indefinite", "uncertain"],
  final_sibilancy: ["yes", "no", "uncertain"],
  semantic_relation: ["ownership", "kinship", "social_relation", "whole_part", "attribute", "event_agent", "event_patient", "authorship", "origin", "temporal", "spatial", "other", "uncertain"],
};
const blank = {classification:"uncertain",alternation_eligible:"uncertain",construction:"",possessor:"",possessum:"",animacy:"uncertain",definiteness:"uncertain",final_sibilancy:"uncertain",semantic_relation:"uncertain",semantic_detail:"",explanation:"",uncertainty:""};
const defaultDiscourse = {text_id:"",start_paragraph:"",end_paragraph:"",givenness:"not_assessed",topicality_mentions:"",discourse_evidence:"",reviewer_note:""};
const label = value => String(value).replaceAll("_", " ");
const count = value => (value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]).length;
const styles = `
.genitive-annotation{margin-top:20px;max-width:100%;min-width:0}.genitive-annotation fieldset{border:1px solid #d4e5f1;border-radius:12px;padding:16px;margin:16px 0;min-width:0;background:#fff}.genitive-annotation legend{font-weight:650;color:#214f73;padding:0 6px}.genitive-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.genitive-grid label,.genitive-full{display:flex;flex-direction:column;gap:6px;min-width:0}.genitive-annotation input:not([type=checkbox]),.genitive-annotation select,.genitive-annotation textarea{width:100%;max-width:100%;min-width:0;box-sizing:border-box;padding:9px 11px;border:1px solid #b9d2e3;border-radius:8px;background:white;color:#213f56;font:inherit}.genitive-annotation textarea{min-height:70px;resize:vertical}.genitive-full{margin:12px 0}.genitive-help{font-size:.85rem;color:#557086;line-height:1.5}.genitive-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.genitive-checkbox input{width:auto!important;flex:0 0 auto;margin-top:3px}.genitive-checkbox{display:flex!important;gap:8px;align-items:flex-start}.genitive-context{max-height:360px;overflow:auto;border:1px solid #d4e5f1;padding:12px;background:#f5faff}.genitive-context p{white-space:pre-wrap;overflow-wrap:anywhere}.genitive-error{background:#fff1f1;color:#882c37;padding:12px;border-radius:8px}.genitive-result{background:#edf7ff;padding:12px;border-radius:8px}.genitive-annotation details{margin-top:12px}.genitive-annotation summary{cursor:pointer;font-weight:600}@media(max-width:650px){.genitive-grid{grid-template-columns:1fr}}
`;

export function SelectedOccurrence({text,start,end}) {
  const chars=Array.from(text||"");
  return <>{chars.slice(0,start).join("")}<mark>{chars.slice(start,end).join("")}</mark>{chars.slice(end).join("")}</>;
}
async function requestJSON(url, options) {
  const r=await fetch(url,options);
  if (!(r.headers.get("content-type")||"").includes("application/json")) throw new Error("The service could not be reached. Check Python is running and the /analyse and /reviews proxies are configured.");
  const d=await r.json();
  if(!r.ok) throw new Error(typeof d.detail==="string"?d.detail:Array.isArray(d.detail)?d.detail.map(x=>`${x.loc.slice(1).join(".")}: ${x.msg}`).join("; "):"The request failed.");
  return d;
}

export default function WordAnnotation({row,result,onResult}) {
  const id=useId();
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [scopeText,setScopeText]=useState(null);
  const pending=useRef(null), saveRequest=useRef(null);
  useEffect(()=>()=>pending.current?.abort(),[]);
  const eligible=/^(of|['’]s|['’])$/i.test(row.match);
  const selection={source_file:row.source_file,paragraph_number:row.paragraph_number,start:row.start,end:row.end,selected_text:row.match};
  const coding=result?.draft || result?.annotation || blank;
  const discourse=result?.discourse || defaultDiscourse;
  const saved=result?.savedReview;
  const patch=(value)=>onResult({...result,...value,checked:false});
  function setCoding(key,value) {
    const next={...coding,[key]:value};
    if(key==="classification") {
      if(value!=="genitive") next.alternation_eligible=value==="not_genitive"?"not_applicable":"uncertain";
      else if(next.alternation_eligible==="not_applicable") next.alternation_eligible="uncertain";
    }
    patch({draft:next});
  }
  function setDiscourse(key,value){setScopeText(null);patch({discourse:{...discourse,[key]:value}});}
  async function run(action,fn,timeout=30000) {
    if(pending.current)return;
    const c=new AbortController();pending.current=c;setBusy(action);setError("");
    let timedOut=false; const timer=setTimeout(()=>{timedOut=true;c.abort();},timeout);
    try{await fn(c.signal);}catch(e){if(timedOut)setError(action==="Saving"?"Save confirmation timed out. Retry unchanged to check the same save request.":"The request timed out. Try again, or annotate manually.");else if(!c.signal.aborted)setError(e.message);}
    finally{clearTimeout(timer);pending.current=null;if(!c.signal.aborted||timedOut)setBusy("");}
  }
  function suggest(){run("Analysing",async signal=>{
    const data=await requestJSON("/analyse/genitive",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(selection),signal});
    onResult({...data,draft:{...data.annotation},discourse:{...defaultDiscourse},checked:false});
  },135000);}
  function manual(){onResult({...selection,model:"manual",prompt_version:"genitive-pilot-v1",annotation:null,draft:{...blank},discourse:{...defaultDiscourse},checked:false});setError("");}
  function save(event){event.preventDefault();run("Saving",async signal=>{
    const final={...coding};
    if(final.classification!=="genitive"){
      final.construction="";final.possessor="";final.possessum="";final.semantic_detail="";
      for(const key of ["animacy","definiteness","final_sibilancy","semantic_relation"])final[key]="not_applicable";
    }
    const anyScope=discourse.text_id||discourse.start_paragraph||discourse.end_paragraph;
    const scope=anyScope?{text_id:discourse.text_id.trim(),start_paragraph:Number(discourse.start_paragraph),end_paragraph:Number(discourse.end_paragraph)}:null;
    const body={...selection,model_name:result.model,prompt_version:result.prompt_version,original:result.annotation,final,scope,
      givenness:final.classification==="genitive"?discourse.givenness:"not_assessed",
      topicality_mentions:final.classification==="genitive"&&discourse.topicality_mentions!==""?Number(discourse.topicality_mentions):null,
      discourse_evidence:discourse.discourse_evidence,reviewer_note:discourse.reviewer_note,checked:!!result.checked};
    const signature=JSON.stringify(body);
    if(saveRequest.current?.signature!==signature)saveRequest.current={signature,body:{...body,client_request_id:crypto.randomUUID()}};
    const receipt=await requestJSON("/reviews/genitives",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(saveRequest.current.body),signal});
    if(receipt.saved!==true)throw new Error("The server did not confirm the save.");
    onResult({...result,savedReview:receipt});window.dispatchEvent(new Event("genitive-review-saved"));
  });}
  function context(){run("Loading context",async signal=>{
    if(!discourse.start_paragraph||!discourse.end_paragraph)throw new Error("Enter the first and last paragraphs of this text.");
    const q=new URLSearchParams({source_file:row.source_file,start_paragraph:discourse.start_paragraph,end_paragraph:discourse.end_paragraph});
    setScopeText(await requestJSON(`/analyse/genitives/context?${q}`,{signal}));
  });}
  function select(key,title){return <label htmlFor={`${id}-${key}`}>{title}<select aria-label={title} id={`${id}-${key}`} value={coding[key]} onChange={e=>setCoding(key,e.target.value)}>{choices[key].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label>;}
  function text(key,title,required=false){return <label className="genitive-full" htmlFor={`${id}-${key}`}>{title}<textarea aria-label={title} id={`${id}-${key}`} value={coding[key]} required={required} maxLength={key==="construction"?1500:key==="explanation"?800:key==="semantic_detail"?300:600} onChange={e=>setCoding(key,e.target.value)}/></label>;}
  if(!eligible)return <p className="genitive-help">Choose “Genitive candidates” above to annotate individual of, ’s and plural s’ markers.</p>;
  return <section className="genitive-annotation" aria-label="Genitive annotation">
    <style>{styles}</style>
    <div className="genitive-actions">
      <button type="button" disabled={!!busy||!!result} onClick={suggest}>{busy==="Analysing"?"Analysing…":"Suggest genitive coding"}</button>
      {!result&&<button type="button" className="secondary-button" disabled={!!busy} onClick={manual}>Annotate manually</button>}
    </div>
    <p className="genitive-help">The model proposes labels; you check them. A candidate is not automatically a genitive. Word lengths are calculated from your confirmed phrases.</p>
    {error&&<p className="genitive-error" role="alert">{error}</p>}
    {saved&&<p className="genitive-result" role="status">Genitive review #{saved.review_id} saved. Open Saved reviews to see or download it.</p>}
    {result&&<form onSubmit={save}>
      <fieldset disabled={!!busy||!!saved}><legend>1. Identify the construction</legend>
        <div className="genitive-grid">{select("classification","Is this a genitive?")}{select("alternation_eligible","Can it alternate between s and of?")}</div>
        <p className="genitive-help">Eligibility is separate from being a genitive. Choose uncertain if the alternative is not clearly comparable in meaning and context.</p>
        {coding.classification==="genitive"&&<>
          {text("construction","Full construction — copy exactly",true)}
          {text("possessor","Possessor phrase — exclude the target ’s / of marker",true)}
          {text("possessum","Possessum phrase — the thing, person or event related to the possessor",true)}
          <p className="genitive-result">Syntactic weight: <strong>{count(coding.possessor)} possessor words</strong> · <strong>{count(coding.possessum)} possessum words</strong></p>
          <p className="genitive-help">Count surface determiners and modifiers. Internal hyphens/apostrophes count as one word; punctuation and the target genitive marker do not count. The server verifies and calculates the saved counts.</p>
        </>}
      </fieldset>
      {coding.classification==="genitive"&&<fieldset disabled={!!busy||!!saved}><legend>2. Review the linguistic factors</legend>
        <div className="genitive-grid">{select("animacy","Possessor animacy")}{select("definiteness","Possessor definiteness")}{select("final_sibilancy","Does the possessor phrase end in a sibilant sound?")}{select("semantic_relation","Semantic relation")}</div>
        <p className="genitive-help">Sibilancy concerns the final sound before adding the genitive ending, not just the final letter. Collective = a group or organisation of people. Use uncertain when needed.</p>
        {text("semantic_detail","Finer semantic sense / relation note")}
      </fieldset>}
      <fieldset disabled={!!busy||!!saved}><legend>3. Text context and discourse factors</legend>
        <p className="genitive-help">Optional until you know the boundaries. Define one essay, passage or exercise, not a whole coursebook containing unrelated texts. Use identical scope rules for both learner groups. Boundaries here must fall between paragraphs.</p>
        <label className="genitive-full" htmlFor={`${id}-text-id`}>Text / essay ID<input id={`${id}-text-id`} value={discourse.text_id} maxLength={200} onChange={e=>setDiscourse("text_id",e.target.value)}/></label>
        <div className="genitive-grid">{[["start_paragraph","First paragraph of this text"],["end_paragraph","Last paragraph of this text"]].map(([key,title])=><label key={key} htmlFor={`${id}-${key}`}>{title}<input type="number" min="1" step="1" id={`${id}-${key}`} value={discourse[key]} onChange={e=>setDiscourse(key,e.target.value)}/></label>)}</div>
        <button type="button" className="secondary-button" style={{marginTop:12}} onClick={context}>Show text scope</button>
        {scopeText&&<div className="genitive-context"><strong>{scopeText.word_count} words in this scope</strong>{scopeText.paragraphs.map(p=><p key={p.paragraph_number}><strong>¶ {p.paragraph_number}: </strong>{p.text}</p>)}</div>}
        {coding.classification==="genitive"&&<>
          <label className="genitive-full" htmlFor={`${id}-given`}>Givenness — earlier mention of the same referent within this text<select id={`${id}-given`} value={discourse.givenness} onChange={e=>setDiscourse("givenness",e.target.value)}>{["not_assessed","given","new","uncertain"].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label>
          <label className="genitive-full" htmlFor={`${id}-mentions`}>Topicality proxy — total mentions of this possessor’s referent in the complete text<input id={`${id}-mentions`} type="number" min="1" step="1" value={discourse.topicality_mentions} onChange={e=>setDiscourse("topicality_mentions",e.target.value)}/></label>
          <p className="genitive-help">Leave blank if not assessed. Count referring noun phrases and pronouns manually, including this occurrence; do not count matching spellings for other referents. Export records mentions per 1,000 text words as a discourse-prominence proxy, separate from givenness.</p>
          <label className="genitive-full" htmlFor={`${id}-evidence`}>Discourse evidence / mention-count note<textarea id={`${id}-evidence`} value={discourse.discourse_evidence} maxLength={2000} onChange={e=>setDiscourse("discourse_evidence",e.target.value)}/></label>
        </>}
        <p className="genitive-result"><strong>Persistence:</strong> calculated from the nearest earlier eligible, reviewed candidate in source order within this exact scope. Unreviewed or uncertain intervening candidates leave it not assessed. “None” is used only after earlier detected candidates have been screened. Saved reviews and exports recalculate it.</p>
      </fieldset>
      <fieldset disabled={!!busy||!!saved}><legend>4. Save your review</legend>
        {text("explanation","Coding explanation (editable)")}{text("uncertainty","Uncertainty / borderline case")}
        <label className="genitive-full" htmlFor={`${id}-note`}>Reviewer note<textarea id={`${id}-note`} maxLength={2000} value={discourse.reviewer_note} onChange={e=>setDiscourse("reviewer_note",e.target.value)}/></label>
        <label className="genitive-checkbox"><input type="checkbox" required checked={!!result.checked} onChange={e=>onResult({...result,checked:e.target.checked})}/>I have checked the classification, phrase boundaries and coded fields. Unresolved fields remain uncertain or not assessed.</label>
        <button style={{marginTop:14}} type="submit" disabled={!result.checked||!!saved}>{busy==="Saving"?"Saving…":"Save genitive review"}</button>
      </fieldset>
      {result.annotation&&<details><summary>Original model suggestion</summary><p>{result.annotation.explanation}</p><p>{result.annotation.uncertainty}</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(result.annotation,null,2)}</pre></details>}
    </form>}
  </section>;
}
