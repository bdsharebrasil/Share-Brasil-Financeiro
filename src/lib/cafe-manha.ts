export function interpretarCafe(value: unknown) {
 const texto=String(value??'').trim(),t=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 if(t==='INCLUIDO')return{tipo:'INCLUIDO',valor:'',rotulo:'Café da manhã incluído na diária'};
 if(['NAO','NAO_OFERECE'].includes(t))return{tipo:'NAO_OFERECE',valor:'',rotulo:'Hotel não oferece café da manhã'};
 const n=Number(texto.replace(',','.'));
 if(t==='A_PARTE'||(texto&&Number.isFinite(n)&&n>0))return{tipo:'A_PARTE',valor:t==='A_PARTE'?'':n.toFixed(2),rotulo:`Café da manhã pago à parte${t==='A_PARTE'?' · valor não informado':': '+n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`};
 return{tipo:'A_CONFIRMAR',valor:'',rotulo:t==='SIM'?'Oferece café da manhã · inclusão a confirmar':'Café da manhã a confirmar'};
}
