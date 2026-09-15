const FIELD_CORNERS=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];

function solve(matrix,values){
  const rows=matrix.map((row,index)=>[...row,values[index]]);
  for(let column=0;column<rows.length;column++){
    let pivot=column;
    for(let row=column+1;row<rows.length;row++)if(Math.abs(rows[row][column])>Math.abs(rows[pivot][column]))pivot=row;
    if(Math.abs(rows[pivot][column])<1e-10)throw new Error('Calibration points do not define a usable field view.');
    [rows[column],rows[pivot]]=[rows[pivot],rows[column]];
    const divisor=rows[column][column];
    for(let index=column;index<=rows.length;index++)rows[column][index]/=divisor;
    for(let row=0;row<rows.length;row++){
      if(row===column)continue;
      const factor=rows[row][column];
      for(let index=column;index<=rows.length;index++)rows[row][index]-=factor*rows[column][index];
    }
  }
  return rows.map((row,index)=>row[rows.length]);
}

export function homography(from,to){
  if(!Array.isArray(from)||!Array.isArray(to)||from.length!==4||to.length!==4)throw new Error('Four source and destination points are required.');
  const matrix=[],values=[];
  for(let index=0;index<4;index++){
    const {x,y}=from[index],u=to[index].x,v=to[index].y;
    if(![x,y,u,v].every(Number.isFinite))throw new Error('Calibration points must be finite.');
    matrix.push([x,y,1,0,0,0,-u*x,-u*y]);values.push(u);
    matrix.push([0,0,0,x,y,1,-v*x,-v*y]);values.push(v);
  }
  return [...solve(matrix,values),1];
}

export function project(matrix,{x,y}){
  const scale=matrix[6]*x+matrix[7]*y+matrix[8];
  if(!Number.isFinite(scale)||Math.abs(scale)<1e-10)throw new Error('Point cannot be projected.');
  return {x:(matrix[0]*x+matrix[1]*y+matrix[2])/scale,y:(matrix[3]*x+matrix[4]*y+matrix[5])/scale};
}

function polygonArea(points){
  return Math.abs(points.reduce((sum,point,index)=>{const next=points[(index+1)%points.length];return sum+point.x*next.y-next.x*point.y;},0))/2;
}

function isConvex(points){
  const turns=points.map((point,index)=>{const next=points[(index+1)%4],after=points[(index+2)%4];return (next.x-point.x)*(after.y-next.y)-(next.y-point.y)*(after.x-next.x);});
  return turns.every(value=>value>1e-6)||turns.every(value=>value< -1e-6);
}

export function createFieldCalibration(imagePoints){
  if(!Array.isArray(imagePoints)||imagePoints.length!==4||imagePoints.some(point=>!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||point.x<0||point.x>1||point.y<0||point.y>1))throw new Error('Tap four points inside the camera view.');
  if(!isConvex(imagePoints))throw new Error('Field corners crossed or are out of order. Re-scan them in the requested order.');
  if(polygonArea(imagePoints)<0.03)throw new Error('Field scan is too narrow. Re-scan the four field corners.');
  return {imagePoints:imagePoints.map(point=>({...point})),fieldToImage:homography(FIELD_CORNERS,imagePoints),imageToField:homography(imagePoints,FIELD_CORNERS)};
}

export function fieldPosition(calibration,imagePoint){
  const point=project(calibration.imageToField,imagePoint);
  return {yardLine:point.x*100,widthYards:point.y*(160/3),inside:point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1};
}

export function sceneShift(reference,current){
  if(!reference?.length||reference.length!==current?.length)return Infinity;
  const differences=Array.from(reference,(value,index)=>current[index]-value).sort((a,b)=>a-b);
  const lightShift=differences[Math.floor(differences.length/2)];
  const residuals=differences.map(value=>Math.abs(value-lightShift)).sort((a,b)=>a-b);
  return residuals[Math.floor(residuals.length*.75)];
}
