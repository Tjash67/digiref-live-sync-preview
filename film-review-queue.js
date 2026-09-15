export const filmSources=[
  {id:'eIi-PnN8Mjs',title:'DeSoto vs. Duncanville',transcript:false},
  {id:'K4fuJf9PvgI',title:'Maple Grove vs. Stillwater',transcript:true},
  {id:'wljAyw0H8VI',title:'Maple Grove vs. East Ridge',transcript:true},
  {id:'PhfG9M3F7ik',title:'Osseo vs. Champlin Park',transcript:true},
  {id:'GivyvwKA9yk',title:'St. John Bosco vs. Bishop Gorman',transcript:false},
  {id:'Oe9jFcdn3Y0',title:'Grayson vs. Collins Hill',transcript:false}
];

export const filmReviewQueue=[
  {video:'K4fuJf9PvgI',time:'31:30',seconds:1890,area:'ball_arrival_contact',cue:'Contested completion; commentary mentions possible defensive interference.'},
  {video:'K4fuJf9PvgI',time:'35:03',seconds:2103,area:'formation_or_substitution',cue:'Pre-snap movement followed by an offensive penalty.'},
  {video:'K4fuJf9PvgI',time:'39:11',seconds:2351,area:'contact_or_restriction',cue:'Scoring play is later described as called back for holding.'},
  {video:'K4fuJf9PvgI',time:'46:25',seconds:2785,reviewTime:'46:32',reviewSeconds:2792,area:'unclear_other',cue:'Back-to-back flags around a scoring sequence; announced call is unclear.'},
  {video:'K4fuJf9PvgI',time:'1:23:07',seconds:4987,area:'ball_arrival_contact',cue:'Incomplete pass with contact and no flag; useful negative/unclear example.'},
  {video:'K4fuJf9PvgI',time:'1:48:28',seconds:6508,area:'formation_or_substitution',cue:'Flag near the snap; commentary questions whether the offense was set.'},
  {video:'K4fuJf9PvgI',time:'1:56:12',seconds:6972,area:'formation_or_substitution',cue:'Flag with commentary suggesting an early start.'},
  {video:'wljAyw0H8VI',time:'5:53',seconds:353,area:'formation_or_substitution',cue:'Opening possession begins with apparent defensive pre-snap movement.'},
  {video:'wljAyw0H8VI',time:'10:37',seconds:637,reviewTime:'10:40',reviewSeconds:640,area:'formation_or_substitution',cue:'Offensive false start is announced.'},
  {video:'wljAyw0H8VI',time:'30:57',seconds:1857,reviewTime:'30:43',reviewSeconds:1843,area:'late_or_out_of_bounds_contact',cue:'Post-play unsportsmanlike-conduct announcement after a fumble sequence.'},
  {video:'wljAyw0H8VI',time:'37:49',seconds:2269,reviewTime:'37:25',reviewSeconds:2245,area:'contact_or_restriction',cue:'Play is called back with holding mentioned.'},
  {video:'wljAyw0H8VI',time:'54:41',seconds:3281,area:'formation_or_substitution',cue:'Right-side hesitation followed by a five-yard offensive penalty.'},
  {video:'wljAyw0H8VI',time:'56:28',seconds:3388,area:'formation_or_substitution',cue:'Delay-of-game sequence with discussion of the play-clock reset.'},
  {video:'wljAyw0H8VI',time:'1:34:09',seconds:5649,reviewTime:'1:34:17',reviewSeconds:5657,area:'ball_arrival_contact',cue:'Incomplete pass with a flag; commentary debates offensive versus defensive contact.'},
  {video:'wljAyw0H8VI',time:'1:42:37',seconds:6157,area:'late_or_out_of_bounds_contact',cue:'Interception followed by an announced roughing-the-passer call.'},
  {video:'PhfG9M3F7ik',time:'18:22',seconds:1102,area:'late_or_out_of_bounds_contact',cue:'Flag arrives at or after the end of a quarterback run; personal foul announced.'},
  {video:'PhfG9M3F7ik',time:'23:27',seconds:1407,area:'late_or_out_of_bounds_contact',cue:'Tackle sequence followed by an announced personal foul.'},
  {video:'PhfG9M3F7ik',time:'34:49',seconds:2089,area:'formation_or_substitution',cue:'Apparent early start before a penalty announcement.'},
  {video:'PhfG9M3F7ik',time:'1:18:37',seconds:4717,area:'head_neck_contact',cue:'Run followed by an announced facemask personal foul.'},
  {video:'PhfG9M3F7ik',time:'1:22:59',seconds:4979,area:'ball_arrival_contact',cue:'Goal-line pass with receiver contact and multiple flags.'},
  {video:'PhfG9M3F7ik',time:'1:26:20',seconds:5180,area:'late_or_out_of_bounds_contact',cue:'End-of-play action away from the ball precedes an unsportsmanlike announcement.'},
  {video:'PhfG9M3F7ik',time:'1:30:54',seconds:5454,area:'contact_or_restriction',cue:'Screen touchdown is erased by an announced illegal block in the back.'}
];

export function filmLink(item){
  return `https://youtu.be/${item.video}?t=${item.reviewSeconds??item.seconds}`;
}
