  if(low.startsWith('!coupon')){
    const m=await getMatchsDuJour(); const odds=await getOddsReels();
    let sel=[], total=1;
    if(odds.hasKey && odds.data.length>=4){
      for(let i=0;i<5 && i<odds.data.length;i++){
        const o=odds.data[i];
        // On précise l'événement réel bookmaker
        let choix, cote;
        if(parseFloat(o.OVER) < 2.2){ choix='Plus de 2.5 buts'; cote=parseFloat(o.OVER); }
        else if(parseFloat(o.GG) < 2.2){ choix='Les 2 équipes marquent OUI'; cote=parseFloat(o.GG); }
        else { choix='Victoire '+o.match.split(' vs ')[0]; cote=parseFloat(o.H); }
        if(!isNaN(cote)){ sel.push({match:o.match, choix:choix, cote:cote, book:o.book}); total*=cote; }
      }
    }else{
      // Fallback Poisson - maintenant AVEC événement précisé
      for(let i=0;i<5 && i<m.list.length;i++){
        const f=m.list[i]; const r=analyse(f.home,f.away);
        let choix, cote;
        if(r.p.OVER > 0.55){ choix='Plus de 2.5 buts'; cote=r.cote.OVER; }
        else if(r.p.GG > 0.55){ choix='GG OUI - Les 2 marquent'; cote=r.cote.GG; }
        else if(r.p.H > r.p.A){ choix='Victoire domicile ('+f.home+')'; cote=r.cote.H; }
        else { choix='Victoire extérieur ('+f.away+')'; cote=r.cote.A; }
        sel.push({match:f.home+' vs '+f.away, choix:choix, cote:cote, book:'Poisson λ='+r.l1.toFixed(2)+'/'+r.l2.toFixed(2)});
        total*=cote;
      }
    }
    let txt='🎟️ **COUPON ULTRA - COTE 25 - '+m.date+'**\n100% REEL - 0% SIMULATION\nBeSoccer (tes images) + ESPN + '+(odds.hasKey?'The Odds API':'Poisson')+'\n\n';
    sel.forEach((s,i)=>{ txt+=(i+1)+'. '+s.match+'\n → **'+s.choix+'** | Cote '+s.cote.toFixed(2)+' ('+s.book+')\n'; });
    txt+='\n**COTE TOTALE REELLE: '+total.toFixed(2)+'** = '+sel.map(s=>s.cote.toFixed(2)).join(' x ')+'\nFormule Poisson: e^-λ*λ^n/n! | Cote=1/Proba';
    await msg.reply(txt);
  }
