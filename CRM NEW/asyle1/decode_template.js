const rxyd = "9بC人$pQñj0=G(h+VA\'3z@viwTdXbMPرn6gZ©EيKOL1%kç,YNlFUu8H!Rs 5rI->cJ国_fy72عSmt中&#.’;4|\":BqaWo/)Dxe<";
const par2 = rxyd.length;

function decode(jysu) {
    let result = '';
    for (let slx9 = 0; slx9 < jysu.length; slx9++) {
        let qu8a = jysu[slx9];
        let qdnh = rxyd.indexOf(qu8a);
        if (qdnh > -1) {
            qdnh -= (slx9 + 1) % par2;
            if (qdnh < 0) qdnh += par2;
            result += rxyd[qdnh];
        } else {
            result += qu8a;
        }
    }
    return result;
}

const inputs = [
    `9sJ国>.4<y:y:EEo’رA.#|\"B4TuFFqx’wo/,wر0=ñ6mJ©pñLz@\'%\"t,VvRo:NiL!)aبD__;5ي3-ECQW_Ljj-uC:UHs4X\':!| W-d)_!e©ñ5r=K1\"X$Gqa:h!,A||U>k0ST-g:T$9O_JJp(eKj0IK,TdiNW’U@X中-R/JرP9cZبعيLñ2s m5k(FAK;REu9 Q4- 9bdd>7R<国_v<K中|JVV&G7çsRqlpXQqD<n国hZ9<N)ب@国V\'G+1;MF\"nz|!©4 5DwyP\"HgPy\"ggLX_EيW_m8HU中@G.l!y\'2,Dst<<#国ر$t<I5B<2ELX$Gqa:h!,A||U>k0ST-g:T$Vcc@= k0Y%`,
    `>(\'h84=Z©u/vOZy>中HeWnlJñI©%MyKO/yh-zUHO4FW.HiBma>Pr国رMc4n_fi9ñ|\";0U1(.=4ABFz/.irn|,wOq69OP0kOmCXbk|3+HF4’’dvIx!BXgzrPر4r$fKp中1ç5taçV.FAq8Riçq-%- &/c’f6<国w0ي9&SV%LL#:2+;4E+r@uWcTR9+M国<بSgJ0HبñXعvmU.1A.|yY@::1n.JرgY-xñK8_ñJO%mg;xعc#3LVU7’rReb8&#xEc2s9_fi9,Qي._1uJ’+a人llXAaH kv)rrAQHOpj Kw,hb1.O+’YZlwq@XLsبC3国.sl>人I©$fR7çG1N-中lwB_人#S8@@mc+9>国3<;QDfB;3(d人ç7xe+H=4:z中XO\'0wIvDb9Iرpj©tijO<jrيG中中6i7RvTm!O-uX ر/I©n2dS%!中ñofr,K|S8VpafoH7Sfl<5Ce6 4|C1m7(1_/)GU#:2+;4E+r@uD;R国.weIJUMC__whIY(VsVYd#jRwيuWFTosç5g9رEU_G(M中W_5Sh2,+#国’!vu عB5g<&ha|>رر\"mT=S中@中=B1yz0;CxndKA |=Gb_weب6WO8رiEmZ0Lhmk3vla©v8(vSUTWW,©|yZي.يyN人ر#f%mY=&uNq1W52)w0\"youI人o76ij:=2AjJ=#中zVFtC人z5/qPd RRبxE62n>j$kOع77VGU#中中Aw0Fz@عFs©Eg5人/-nي$f$lJçL’=jj,8K.lF$.2:dIc/g#CE;/国n©v<çpE#)0Yi+Hبis$+/qPs!!)C:Me<UM@Zع=uK’NGik.8AA2u|v8P1qqJM<>g92EO:cK$j/y%==cH$q8RjB2D| I)uCVo4<EVCkG>Cmj#1G|2+uwt中X! 人%@/55Vp8K$ñsيiç(XL#Khn,|.W\"  عFSunb_x))6Od国©Ea国_Y%4W,8K.lF$.8@@mc+9>国-;中sñعT=$OC.1n\'xz’d\'mzqB wsرvgP1人يJ>>人=DEQñ5Ehç中++..©dS5Tbw%ي3国PQfE4ILE中Q$$1lZtç,9tR|%s#;Is<XTT-y!eJ国@e’QmW#;n\'\"J’’NN$/1/qP;nبhw人<KW671DQh<O0=-OTN3gidS5M0MAsx国@sn%国E:>E$$ Ne;YFي(TpfR70)عx\"crkXKz4国j$r人L(c.t\'1uXmب4Wt3:BL3人Xx(ب$uيñ:ñ国中Uبd©=Mw uJ%zl\"4HlweR%J#RN\"7FعO©!Fر#f%j(eSY++f j/srNiZV#国’zp4ñxy中X(.rVk4#@AlYYW:bwRHH<)Z-rr9ñog人$Rg+1بVEOzV!4’’@bhHwT中HK-6NEOqS%wKKQQrF9F,:Oqsy.5!xNaM9u-y!eJ国@e’QmW#;n\'\"J\"عV8T中VqبT)kv)rrAQHOpj7E0/hbcFPu1v\'HFiñi- Asx国@©n2ej’ر!K,nع1%xعs’U国! j/I1Ii6ñ!.Wc4&+jv<SpLK=p&u(<vZ($LXQMDWGQ\"ZT<-国uP人ffT+-NhA#ç\'Cv©ع يrFPdJID//E6عf人ببkO.t=jjUYB4\'VV HDwvv5国u)->\')DSyG3ع.Jjt中رj.YY人oLXW)a=p|gبUEر国MjO_jç+Xعk|(1HF-w :||wرAsXb.sgJ<ZZCCR,D.çNk> KBFXasp;Is<XTT-y!eJ国@e中Q>&ب$;&zYçç4Wt3:BL3人Xx(ب$uيñ:人人ffT+-+=F$uvgkwz5(8o-AXgzrPر4rçfKH%,D.`,
    `J,J8DgpsDf.pSTCSLLx\"Z@|Bm$qV)aعsW)ZرBP_Koj$kf#8人bG3$ç+V_çP8wKbر#cg+g)p&bu-E!F\"#/y,thG’tFT4y/ñ4TiI9_.b<K)_6Ei92KK)463;\"عC:h:)%Me中nrبxE6J>>j$kOع77VGU#中中Aw0Fz@عFر \'n8R©n2ب<<EkP7OL)7!#lc8RQW5O!!ii中国A国-$RQS:et2hcñçAf#:2+;4E+<iojx9Ng人;人anyL)nQ\'LGrيG中中6i7RvTwO+UرXd)(ر7国TJpmMkO.QAaK>YHO’FUp’Ja5m>国ACyFyرLV>q9عo:iAPñ;hlY3h:r@ñP%@r <©p\'>Zmرpfع ©0mmر@fHzivي(lMTcr)oo©n2_C99%K#m0ññF,:;A++s8)i@@ JU/I-A/عf=\'2#cñmtPñ#,,CWOda/q0$469F©PJbñoZ国f’KXعk|hP6bjR3NrRfPc/WWPEi>6g:>O2pLLjj-uC:UHFycç)R6x>Gq_>p6ررftI$2عX$4(y|ñ=q|d8UUae;T/)YT06人3ñ= kh/00mmر@f@AR= bOFPdJ35<fi6Od国©Ea国UmçrluC:!©!%|w)Y| y)>+W>رر\"mT=S中E+&D1\"(2=q|1dañ8ew4)ZرBP_Koj$kf#8人bG3$ç+V_çP8wKbر#cg+g)p&bu-E!F\"#/y,thG’tFT4y/ñ4رaiTE)’M9O2_B;-(CmOkPñ#,,CWOda/uP)GsCbBd9ñ!L=akعh0lç&tt@ARu\"44bw>oaaM©v-n6\"-%7PkJfNk|hGGlR14u8ñ4_oI中Jf3$2u__ZZa#M#mAf3:9=q|d中zsM’o9|XDxlXGZp@0(r,VDV人k;8ñk3P8wعFwaaçZ4fgEB_يب<2h عg7F,%’U+(\"X2:Ys<)U/n人!7国j6%\'JWS’国0中&n0/\':人W)%Me中es_1WAXبz+l%Rg=OtSçO+BYgRyY)8\"Bبsço-$©nU,XmcK$j/y%==cH$q8RjBs@3o6&/8WyJñ人©gg中ع+=%LL|.v\'FNNoBMTs!!9D©>IIبj/Z$psZ’LعmBç6#FWwE5D\'MTkKz_P يgS’EkP7OL)7kGGJ!paHs8ع_Ne>Vب)رo7wñ7BZ&pcmx中Sh;ç%\'s$3&q5Pc:)G+0qي9P1يFG,S22G3$ç+V_çv8\"iiqqkg;_6©nU,Xmي+中ço%a+FrNTI!J.5!xTiir_8D>c3Dm$It<C.t\'ç%%’qSA|\"KAبT)=<CF©p|بب国国i(r(jNCFzn1v\'s=Uar+Tn\' bM’ %国EuLk/&YbYZtV\"KtFI\"!Q;!ii中国ACJf;QL-S中-E.r$;&lzHt4btF)SaرX4d>ZB$9Ocml<wñ+9L=G>LdlzZwXmrP=PaبSwN 6U,’mqJ120ñ中2,@#Jq人#X\"3@6a中TD©_’pOIعfq4>hS$中1,n0’NN$/1boD0n国qب$q-ñ:P0pçLS22A(uN’##wz5B\"\"Tn\' bM’ K国dOIckO.0ññçuي#Nl人#>BsعIc+9_N>>رر\"mTm7(c+;DQ|.vعV8T中BD.iWoçiñربApjR1GWG<O&l人O+dlzf,z\"\"Lر#cP6,fpXيqf9tL国,1h;3OYk;haH8)aYqb<U国-$MKhI:y中-pعSbpqh;<:aKT/ع/8>ي:(ixV=çKuPQ©2yL©=4%PuJ%al’4x8LB 9nç_$dE6uYbtي国LQ=D2ç((国RQW! 2Dرu>VDd人国/2_0pي©©#mA(ç%%:;wUllBD.iWoçi人رq$dMj$k2yy0AC%(hJ%bUvEdM中-n(bb))lKBKZmM中, fNk|E&\'BLU k\"H!0\"y)>#_7@QSHSI$1hJ$中qh;6=;llp)%M/xRبMfCpa>jBر=Q=+1;GH$中vC\'s8GuWIVرX国o人tdFgLX_EيW_ut,IF8人BRER\'bCFm\"5&ع0人A/f9©gp9عYñ/APñ8hçY5\'pUi-D0n国qبxAGWOCرpfع ©0mmر@fHzi;XHDbرAag+F:z6HiH>xR(ghec$GoLLpEe74;VmرunVvTs/KrdUd.P国O’ lc<XLE中s QAzk_CJJL&s/3!-Na 5ha-!Pgñxm7(pSP&AqرjhMiia/zIR’رo( 人;人QH6pv$brddبي(zp,VAf,z|qIM1cبiKODF2U-1.yhj6’5-=8gl/Q4!2HxoacrCeHM7国j5g7&>QSmMQ&7çli(W:b@aç)np,wMkييQ7E1UeLX+\'JkA6VK2EE(lwرAsXb.sرxبعO8t(gFUñI4-S8&4q<kBعRبhW-#I$9e2_0pI©&SV国L&\"7h’;©h\"&uRPz<)ZbeuCK(8ر©Uççh&p.’p8@w2FiKvç&%%3!PEi>6g:>E人ñ#,5;3ORsh_af.5|FXbF9IQ3x_|国0p人中ع+=国L4#@2,4Wt3:BL3W4sIZT$9O6人sñk\' ©LRFF3+iN©E wXP&RMçbU|llTI©%MyKO/y%0h\"uJqT,->zSxm:J中fD;4Qyfhd$moSA(=|.v\'SNW:b#8W<4d)DNd<Wcf1nGñYO=c+UTJ%N>ssdtI!%% SgE\">©uZ oRRnf`,
    `tlpl("/-ha-PP|Sw0عtE.0l’6h%@|Ga\"a)i-WBXRg<eيgW671DGñY2;RQر+vñN\'37N6RX1رg;_E\'Eej’ر!JO 8q;xعl#A+|#8b:عx=:g/dbOe|n人%mq(Yf.txW7@’G|l8KAq!!GبlZ9人-ñZmj Kf,GEA(uN’##wz5!q::رX国-x))يgSy$CCçL’=jj,8K.lF$.8zwxm<g!国Hx中بI:Sya|c+mp4#@b;am\'\":O\'aRR(CF©ب$9z+)%=r,Otي\'M中’HgRo+vpH© @çMçN%w2g>t2|ç.0ññçuي#Nl人#!B@RRww&_\'人国yJ\".r=2N(#X中TN|D; xaبV)aر RRD人BP<9uP=يxGñd+|K3+H;..zX(8iwt8يInY©KBع1iييpp5l<lç\"KBRf# HDYqb<UIfHxcJzx.pSa&’رA|c|2+uwt+B9w/%@/55Vp8K$ñy%AيC9bVMU:0%i3! n8\'V%Xe国人Tn2_d国QtPçL’ñ\'WOcN!L;UuQ;国Wrtc_\'人7U7n1AcaبS/Bw\'رj4+FNz+BIvjرkv)5>EAKSxjDE3L人bVGرdQHAçz4BعFwaaçZ4fgEبع,_nPsç ’\'KعYH$qsيovrRe/XTT_>pبgnnm7(Oييt4fG#.gGWz中oBñDJ@9D©>IIبj/Z$psZz%hM\'@fHw$zz\"\"Lر#رX国@fيFrO©tMy0#6%F©中,Yب中I\"!75-(eJ,J8DgpsDf.pSTCSLLx\"Z@|BWt@:bRD0n国qw人<1WZC17Qt,’$GUYp,|!0T@r\"xyzkbZ@Iرn|I,yO!kYx’FرFGvDkf#82国人x=:-/Pb</国Lب:=wبعK%AD38m:SAe@’ñ)a=p|gDT<-国uP人ffT+-NhAzpNV!|wE5D\'UرX国-x))يgSy$CCçL’=jj,8K.lF$.rqYIstc©afcQgnny中-pعSbpqh;<:aKT/عqq!!GبlبxEaKj@ر=Q,<O&l人h@QYA\'yYn!dLP6’国©A©wc$SbcKFSk)7kGGJ!paHs3Iaرt<<#国.$KrDSyS&ñYm1AAe.v\'SAHd&)aر!JOq+epanبCHnEfKXLh(kt,gN@wiHAxW>/b5oIl>©Kع©يP)çd%r4FrmHFWAyP!!5cGB4|<xcJñ:fQ©aQFVtha7hs;z#3X<ب’w_Ak12d9no@Hnfw;©VGUYhrYawzZ/>人Tcr)oo©n26.国=يçر2L1D2>\"\"国H_,7/iR_s>kmaf3wç$0py3pY.t\'h,kkB4TuFFqx’wo/,w>人=WOO$©xy;’+SPUر+@A©FiKlMTc/WWPEi>6g:>4中kH1g<lPS8laF<|b!-Na 5haDbe|97y人Zpoñ&’D,.hçV人\'qoWw|c56IxxrSpJR国ikgh0lSMB++3wf,1%RHwTcçb>)N>0عZ7Ny,#L中by_x)T中U4k2ñ4vmZB国-$9ch91m7(jLKK;&zYçç4Wt3:BL3人466ب2ب6cQ\"$7=\'<YYG%$中aqv’E يvbw%sP,P#dnU<,N1çع+5’\'-FA:国VaWX’rRedww国-$GJع بfywبWk.b&aç\"’iCl!v#R3edNMP)<BgDp$\"jع,G=+GhDBAZ2s@88ZTçYG1TpQñsRm74k#jQQkUE&YNC&-3 Ma5mWUIع-flX_w0人K(t#lGx%WçqV人l@r/jPPG)hZZA$3$xtGET,©VG>Vu,g\'Ws|@zwh @PM-6<7©Z9©ي(عQ1t\'ç=cYlV;>82qRfo8;CeرMM2_0f\'$,S’国0中&n0بii$Wp;jP /p)ب.(XQ|人9ñQ>;1lçG çBv\'s8:||MTc/WWZر7>gqيmNa国aعQmkul(D_#V:3i=j)4BIfHxcJzx:Zç中K#:Lx4:V!Cw pBñMM=eGq+©c9国$©l7K7.hعMFP3vñF\'s$Nb-Bd635MP;56d9$tJçL’Sk9N\" ب中;V|2: R.+&&8Wc2s9_fi92ي1V’D38mo/N$dpADNHT(X<xيgnñ人%Kxyh0lCmh@QYA\'yY@h:W>86MfIn:©ع,Bcjع%0’,k_CJJL&u5ç:!R=:5dP人f;QL-#.©Who$;jh;Nv\"4dvz)aرX4sبxEq-بj/Z$psZjبS&UL@ARlzSwrgmuDP国rA中Jej8©5/ss6ykUE&YNC&U\'v)rSe6H72b;p4DS9عGp5v=LUe#v\'Va\"Xi#8xo6| x$qر9ب8ر$xySYEA(uçVyzRP7NMRV MXF4NNwrZ1bfيKof1j(|UcBwçI-3عDS\"c$D8e国cñ人بm7(jcK’中3yk’qSA|\"KAq’!56iCeيرب!p1VRg+1بpM\"hEyZZ=YvM+!Td&!M)<7يUS=nNlp5’r2Ua’Ok_du)aB- 9DuXfcQsnftI$2عX$tf%Y@=q|d3B%oP人kvCDxjS人cfd ww<©=\'人kh+国k\';:5XO-<@Eي/NylrO&©EKo%Q=4#中uNq|1A HDYv JU/I-A/J 6E=9&SVj中6’zogGDtddGk004vD人BP<9uP人_2ç(dN4Qiw&g!Z,dhhIIcr gPyJweO©tM人OY6S%keSYO+3W.5!xq +-بعVoLr\":0ع7DM//_Q#:2+;4E+:uRPx=6_añj-3Ozر=sبdXNhGuN,v\'s8G|bw>AabZ@Iرn|IZbCQ&_Y%4t,CFBr人#j/,人xr ;A..!/国S5Cy7TCSOk\'4e@!中)DFQbñ3eq6\"1©ب<O©g0pçL<2VGU$中Vijl3z2liVq/J!Zر7>gqيmNa国:m`
];

const fs = require('fs');
let fullOutput = '';
inputs.forEach(i => {
    let jysu = i.replace(/^tlpl\(\"/, '').replace(/\"\);$/, '');
    let decodedChunk = '';
    for (let slx9 = 0; slx9 < jysu.length; slx9++) {
        let qu8a = jysu[slx9];
        let qdnh = rxyd.indexOf(qu8a);
        if (qdnh > -1) {
            qdnh -= (slx9 + 1) % par2;
            if (qdnh < 0) qdnh += par2;
            decodedChunk += rxyd[qdnh];
        } else {
            decodedChunk += qu8a;
        }
    }
    fullOutput += decodedChunk;
});

fs.writeFileSync('c:/CRM NEW/asyle1/decoded_zynix.html', fullOutput, 'utf8');
console.log('Decoded template saved to decoded_zynix.html');
