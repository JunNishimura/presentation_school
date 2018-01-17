#version 150

// デフォルト設定
uniform float u_time;
uniform vec2 u_resolution;
out vec4 outputColor;

const int MAX_MARCHING_STEPS = 255; // ループ回数。この回数分レイを進める
const float MIN_DIST = 0.0; // レイの最短距離 // レイの初期位置
const float MAX_DIST = 100.0; // レイの最大距離
const float EPSILON = 0.0001; // ０に限りなく近い数

const float PI = 3.1415926;
const float TWO_PI = PI * 2.0;
const int oct = 8;
const float per = 0.5;

// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <effect functions>  //

// function to create random value
// 簡単な方法。raymarchingでもpost-processingでの乱数利用であれば、スクリーンに描画するだけだから、引数はvec2型で、スクリーンの正規化された座標をぶち込めばよい。
float easy_random (vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 4.1414))) * 43758.5453);
}


// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <function of transformation>  //
// thetaにはradians()を通してから代入する

// x軸で回転
mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3 (
                 vec3(1, 0, 0),
                 vec3(0, c, -s),
                 vec3(0, s, c)
                 );
}

// y軸で回転
mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3 (
                 vec3(c, 0, s),
                 vec3(0, 1, 0),
                 vec3(-s, 0, c)
                 );
}

// z軸で回転
mat3 rotateZ(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3 (
                 vec3(c, -s, 0),
                 vec3(s, c, 0),
                 vec3(0, 0, 1)
                 );
}

// xyz同時に回転
// axisはどの軸にどれだけ回転させたいか. もし(1.0, 0.5, 0.0)だとx軸に対して100%y軸に対して50%ということになる
mat3 rotate(float theta, vec3 axis) {
    vec3 a = normalize(axis);
    float c = cos(u_time);
    float s = sin(u_time);
    float r = 1.0 - c;
    return mat3 (
                 a.x * a.x * r + c,
                 a.y * a.x * r + a.z * s,
                 a.z * a.x * r - a.y * s,
                 a.x * a.y * r - a.z * s,
                 a.y * a.y * r + c,
                 a.z * a.y * r + a.x * s,
                 a.x * a.z * r + a.y * s,
                 a.y * a.z * r - a.x * s,
                 a.z * a.z * r + c
                 );
}

// 2 dimension rotation
vec2 rotate2D(vec2 p, float angle) {
    float c = cos(angle); float s = sin(angle);
    return vec2 (
        p.x * c - p.y * s,
        p.x * s + p.y * c
    );
}


// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <function to draw multiple objects at one time> //


float smoothMin(float d1, float d2, float k) {
    float h = exp( -k * d1 ) + exp( -k * d2 );
    return -log(h) / k;
}

vec4 unionSDF2(vec4 d1, vec4 d2) {
    return d1.w < d2.w ? d1 : d2;
}

vec4 intersectSDF2(vec4 d1, vec4 d2) {
    return d1.w > d2.w ? d1 : d2;
}

vec4 differenceSDF2(vec4 d1, vec4 d2) {
    return d1.w > -d2.w ? d1 : vec4(d2.rgb, -d2.w);
}

vec4 unionWithSmoothSDF(vec4 d1, vec4 d2, float k) {
    float smooth_d = smoothMin(d1.w, d2.w, k);
    vec4 s = d1.w < d2.w ? d1 : d2;
    s.w = smooth_d;
    return s;
}


// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <object function> //

float sphereSDF(vec3 samplePoint, float sphereSize) {
    return length(samplePoint) - sphereSize;
}

float cylinderSDF( vec3 p, float h, float r) {
   
    float inOutRadius = length(p.xy) - r;
    float inOutHeight = abs(p.z) - h/2.0;
    float insideDistance = min(max(inOutRadius, inOutHeight), 0.0);
    float outsideDistance = length(max(vec2(inOutRadius, inOutHeight), 0.0));
    return insideDistance + outsideDistance;
}

float easyCylinderSDF (vec3 p) {
    vec2 c = vec2(0.0, 0.0);
    float radius = 0.5;
    return length(p.yz - c.xy) - radius;
}

// repeat angle function
vec2 repeatAng(vec2 p, float n) {
    float ang = 2.0 * PI / n;
    float sector = floor(atan(p.x, p.y)/ang + 0.5);
    p = rotate2D(p, sector*ang);
    return p;
}

float repeat(float coord, float spacing) {
    return mod(coord, spacing) - spacing/2.0;
}


// 各オブジェクトが固有のカラーを持てるように変更
// returnをvec4にしている。んで各オブジェクトにカラー.rgbでセット
vec4 sceneSDF2(vec3 samplePoint) {
    
    // make 4 spheres
//     size_sphere = 1.5, pos_offset = 1.0
//     size_sphere = 1.0, pos_offset = 0.72
    
// --------------------------------------------------------------- //
    //  <case 1>
//    samplePoint = mod(samplePoint, 2.0) - 1.0;
//
//    float size_sphere = 1.0;
//    vec3 pos_offset = vec3(.72);
//    float sp1 = sphereSDF(samplePoint+pos_offset, size_sphere);
//    float sp2 = sphereSDF(samplePoint+vec3(-pos_offset.x, pos_offset.yz), size_sphere);
//    float sp3 = sphereSDF(samplePoint+vec3(pos_offset.x, -pos_offset.y, pos_offset.z), size_sphere);
//    float sp4 = sphereSDF(samplePoint+vec3(-pos_offset.x, -pos_offset.y, pos_offset.z), size_sphere);
//    float sp5 = sphereSDF(samplePoint+vec3(pos_offset.xy, -pos_offset.z), size_sphere);
//    float sp6 = sphereSDF(samplePoint+vec3(-pos_offset.x, pos_offset.y, -pos_offset.z), size_sphere);
//    float sp7 = sphereSDF(samplePoint+vec3(pos_offset.x, -pos_offset.yz), size_sphere);
//    float sp8= sphereSDF(samplePoint+vec3(-pos_offset), size_sphere);
//    vec4 sphere = vec4(vec3(1.0, 0.0, 0.0), sp1);
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp2));
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp3));
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp4));
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp5));
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp6));
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp7));
//    sphere = unionSDF2(sphere, vec4(vec3(1.0, 0.0, 0.0), sp8));
//
//    vec3 pos_c = samplePoint;
//    float c = cubeSDF(pos_c, vec3(1.0));
//    vec4 cube = vec4(vec3(1.0, 0., 0.), c);
//    vec4 fin_out = differenceSDF2(cube,sphere);
    
// --------------------------------------------------------------- //
    // <case 2>
//    vec4 neuron;
////    vec3 pos_s = samplePoint;
//    vec3 pos_n = samplePoint;
//    pos_n.x += sin(u_time+sin(pos_n.z+u_time)*2.5)*0.3;
//    pos_n.x += cos(u_time+sin(pos_n.y+u_time)*2.5)*0.3;
//    pos_n.y += cos(u_time+cos(pos_n.x+u_time)*2.5)*0.3;
//    //    pos_n = vec3(mod(pos_n*0.8, 4.0) - 2.);
//
//    float scale_down_sp = 0.3;
//    float scale_down = 0.2;
//    vec4 sph = vec4(vec3(0.8*sin(length(pos_n)+u_time), 0.01, 0.44)*2., sphereSDF(pos_n / scale_down_sp, 1.0) * scale_down_sp + 0.02 * (sin(40.0*pos_n.x)) * (sin(40.0*pos_n.y)) * (cos(40.0*pos_n.z)));
//    float cy_h = 10.0;
//    float cy_w = 0.1;
//    vec3 cy_offset = vec3(0.0, 0.0, 3.0*scale_down);
//    vec3 cy_color = vec3(0.8*sin(length(pos_n)+u_time), 0.01, 0.44)*2.;
//    vec4 cy_front = vec4(cy_color, cylinderSDF((pos_n + cy_offset) / scale_down, cy_h, cy_w) * scale_down);
//    vec4 cy_back = vec4(cy_color, cylinderSDF((pos_n + vec3(cy_offset.xy, -cy_offset.z)) / scale_down, cy_h, cy_w) * scale_down);
//    vec4 cy_up = vec4(cy_color, cylinderSDF((pos_n.xzy + vec3(cy_offset.xy, -cy_offset.z)) / scale_down, cy_h, cy_w) * scale_down);
//    vec4 cy_down = vec4(cy_color, cylinderSDF((pos_n.xzy + cy_offset) / scale_down, cy_h, cy_w) * scale_down);
//    vec4 cy_left = vec4(cy_color, cylinderSDF((pos_n.yzx + vec3(cy_offset.xy, -cy_offset.z)) / scale_down, cy_h, cy_w) * scale_down);
//    vec4 cy_right = vec4(cy_color, cylinderSDF((pos_n.yzx + cy_offset) / scale_down, cy_h, cy_w) * scale_down);
//    //    neuron = unionSDF2(sphere, cy_front);
//    //    neuron = unionSDF2(neuron, cy_back);
//    //    neuron = unionSDF2(neuron, cy_up);
//    //    neuron = unionSDF2(neuron, cy_down);
//    //    neuron = unionSDF2(neuron, cy_left);
//    //    neuron = unionSDF2(neuron, cy_right);
//    neuron = unionWithSmoothSDF(sph, cy_front, 8.0);
//    neuron = unionWithSmoothSDF(neuron, cy_back, 8.0);
//    neuron = unionWithSmoothSDF(neuron, cy_up, 8.0);
//    neuron = unionWithSmoothSDF(neuron, cy_down, 8.0);
//    neuron = unionWithSmoothSDF(neuron, cy_left, 8.0);
//    neuron = unionWithSmoothSDF(neuron, cy_right, 8.0);
//
//    return neuron;
    
// --------------------------------------------------------------- //
    // <case3>
    // 大体この1.5/0.7で商が2だから2本分描画される
//    pos_n.x = mod(clamp(pos_n.x, -1.5, 0.0), 0.7) - 0.35;
//    pos_n.z = mod(clamp(pos_n.z, -4.0, 0.0), 2.0) - 1.0;
    
    float step1 = step(mod(u_time*0.1, 2.0), 1.0);
    float step2 = 1.0 - step(mod(u_time*0.1, 2.0), 1.0);
    
    vec4 neuron;
    float cy_h = 10.0;
    float cy_w = 0.05;
    
//    vec3 cy_color = mod(u_time*0.1, 2.0) < 1.0 ? vec3(0.8*sin(length(samplePoint)+u_time))*2. : vec3(0.8+0.2*sin(length(samplePoint+u_time)), 0.8+0.2*sin(length(samplePoint)+u_time), 0.0);
//    vec3 sp_color = mod(u_time*0.1, 2.0) < 1.0 ? vec3(0.8*sin(length(samplePoint)+u_time))*2. : vec3(0.8, 0.8, 0.0);
    vec3 cy_color = vec3(0.8*sin(length(samplePoint)+u_time))*2. * (step1+step2);
    cy_color += vec3(0.8+0.2*sin(length(samplePoint+u_time)), 0.8+0.2*sin(length(samplePoint)+u_time), 0.0) * (step1+step2);
    vec3 sp_color = vec3(0.8*sin(length(samplePoint)+u_time))*2. * (step1+step2);
    sp_color += vec3(0.8, 0.8, 0.0) * (step1+step2);
    
    
    // first set of the cylinders
    vec3 p1 = samplePoint;
//    p1 = p1*rotate(u_time * 0.5, vec3(sin(u_time), cos(u_time), 1.0)); // rotate entire object
//    p1.xy = rotate2D(p1.xy, length(p1.x)*0.2);
//    p1.yz = rotate2D(p1.yz, length(p1.y+0.1)*0.5);
    p1.xy = rotate2D(p1.xy, 2.0/PI);
    p1.x += sin(u_time+sin(u_time+p1.y))*0.32 * (step1);
    p1.x += sin(u_time+sin(u_time+p1.y))* (easy_random(p1.xy)) * (step2);
    p1.y += cos(u_time+cos(u_time+p1.x))*0.5 * (step1);
    p1.y += cos(u_time+cos(u_time+p1.x))* (easy_random(p1.xy)) * (step2);
//    p1.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+sin(u_time+p1.y))*0.32 : sin(u_time+sin(u_time+p1.y))* (easy_random(p1.xy));
//    p1.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+cos(u_time+p1.x))*0.5  : cos(u_time+cos(u_time+p1.x))* (easy_random(p1.xy));
    vec4 sp1 = vec4(sp_color, sphereSDF(p1, 0.35) + 0.02 * (sin(40.0*p1.x)) * (sin(40.0*p1.y)) * (cos(40.0*p1.z)));
    p1.xy = repeatAng(p1.xy, 3.0);
    float cy_1 = cylinderSDF(p1.xzy, cy_h, cy_w);
    vec4 cy1 = vec4(cy_color, cy_1);
    cy1 = unionWithSmoothSDF(cy1, sp1, 10.0);
    
    
    // second set of the cylinders
//    vec3 p2 = samplePoint + cos(u_time)*.80;
    vec3 p2 = samplePoint+vec3(sin(u_time*0.5)*0.5);
    p2.x += sin(u_time+cos(u_time+p2.y))*0.57 * step1;
    p2.x += sin(u_time+sin(u_time+p2.y))* (easy_random(p2.xy)) * step2;
    p2.y += cos(u_time+sin(u_time+p2.x))*0.425 * step1;
    p2.y += cos(u_time+cos(u_time+p2.x))* (easy_random(p2.xy)) * step2;
//    p2.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+cos(u_time+p2.y))*0.57  : sin(u_time+sin(u_time+p2.y))* (easy_random(p2.xy));
//    p2.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+sin(u_time+p2.x))*0.425 : cos(u_time+cos(u_time+p2.x))* (easy_random(p2.xy));
    p2 = p2 * rotateY(TWO_PI/4.0);
    vec4 sp2 = vec4(sp_color, sphereSDF(p2, 0.35) + 0.02 * (sin(40.0*p2.x)) * (sin(40.0*p2.y)) * (cos(40.0*p2.z)));
    p2.xy = repeatAng(p2.xy, 3.0);
    float cy_2 = cylinderSDF(p2.xzy, cy_h, cy_w);
    vec4 cy2 = vec4(cy_color, cy_2);
    cy2 = unionWithSmoothSDF(cy2, sp2, 10.0);
    
    // third set of the cylinders
    vec3 p3 = samplePoint+vec3(cos(u_time*0.5)*0.45);
    p3.x += sin(u_time+cos(u_time+p3.y))*0.62 * step1;
    p3.x += sin(u_time+sin(u_time+p3.y))* (easy_random(p3.xy)) * step2;
    p3.y += cos(u_time+sin(u_time+p3.x))*0.68;
    p3.y += cos(u_time+cos(u_time+p3.x))* (easy_random(p3.xy)) * step2;
//    p3.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+cos(u_time+p3.y))*0.62  : sin(u_time+sin(u_time+p3.y))* (easy_random(p3.xy));
//    p3.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+sin(u_time+p3.x))*0.68  : cos(u_time+cos(u_time+p3.x))* (easy_random(p3.xy));
    p3 = p3 * rotateY(TWO_PI/4.0) * rotateX(TWO_PI/8.0);
    vec4 sp3 = vec4(sp_color, sphereSDF(p3, 0.35) + 0.02 * (sin(40.0*p3.x)) * (sin(40.0*p3.y)) * (cos(40.0*p3.z)));
    p3.xy = repeatAng(p3.xy, 3.0);
    float cy_3 = cylinderSDF(p3.xzy, cy_h, cy_w);
    vec4 cy3 = vec4(cy_color, cy_3);
    cy3 = unionWithSmoothSDF(cy3, sp3, 10.0);
    
    // fourth set of the cylinders
    vec3 p4 = samplePoint+vec3(cos(u_time*0.5)*0.5, sin(u_time*0.5)*0.5, 0.);
    p4.x += sin(u_time+cos(u_time+p4.y))*0.5 * step1;
    p4.x += sin(u_time+sin(u_time+p4.y))* (easy_random(p4.xy)) * step2;
    p4.y += cos(u_time+sin(u_time+p4.x))*0.625 * step1;
    p4.y += cos(u_time+cos(u_time+p4.x))* (easy_random(p4.xy)) * step2;
//    p4.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+cos(u_time+p4.y))*0.5   : sin(u_time+sin(u_time+p4.y))* (easy_random(p4.xy));
//    p4.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+sin(u_time+p4.x))*0.625 : cos(u_time+cos(u_time+p4.x))* (easy_random(p4.xy));
    p4 = p4 * rotateY(TWO_PI/4.0) * rotateX(-TWO_PI/8.0);
    vec4 sp4 = vec4(sp_color, sphereSDF(p4, 0.35) + 0.02 * (sin(40.0*p4.x)) * (sin(40.0*p4.y)) * (cos(40.0*p4.z)));
    p4.xy = repeatAng(p4.xy, 3.0);
    float cy_4 = cylinderSDF(p4.xzy, cy_h, cy_w);
    vec4 cy4 = vec4(cy_color, cy_4);
    cy4 = unionWithSmoothSDF(cy4, sp4, 10.0);
    
    // fifth set of the cylinders
    vec3 p5 = samplePoint+vec3(0., sin(u_time*0.5)*0.5, cos(u_time*0.5)*0.45);
    p5.x += sin(u_time+cos(u_time+p5.y))*cos(u_time)*0.76 * step1;
    p5.x += sin(u_time+sin(u_time+p5.y))* (easy_random(p5.xy)) * step2;
    p5.y += cos(u_time+sin(u_time+p5.z))*sin(u_time)*0.78 * step1;
    p5.y += cos(u_time+cos(u_time+p5.x))* (easy_random(p5.xy)) * step2;
//    p5.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+cos(u_time+p5.y))*cos(u_time)*0.76 : sin(u_time+sin(u_time+p5.y))* (easy_random(p5.xy));
//    p5.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+sin(u_time+p5.z))*sin(u_time)*0.78 : cos(u_time+cos(u_time+p5.x))* (easy_random(p5.xy));
    p5 = p5 * rotateX(TWO_PI/4.);
    vec4 sp5 = vec4(sp_color, sphereSDF(p5, 0.35) + 0.02 * (sin(40.0*p5.x)) * (sin(40.0*p5.y)) * (cos(40.0*p5.z)));
    p5.xy = repeatAng(p5.xy, 3.0);
    float cy_5 = cylinderSDF(p5.xzy, cy_h, cy_w);
    vec4 cy5 = vec4(cy_color, cy_5);
    cy5 = unionWithSmoothSDF(cy5, sp5, 10.0);
    
    // sixth set of the cylinders
    vec3 p6 = samplePoint+vec3(sin(u_time*0.5)*0.45, 0., cos(u_time*0.5)*0.5);
    p6.x += sin(u_time+cos(u_time+p6.y))*sin(u_time*1.2)*0.7 * step1;
    p6.x += sin(u_time+sin(u_time+p6.y))* (easy_random(p6.xy)) * step2;
    p6.y += cos(u_time+sin(u_time+p6.z*p6.y))*cos(u_time*0.85)*0.7 * step1;
    p6.y += cos(u_time+cos(u_time+p6.x))* (easy_random(p6.xy)) * step2;
//    p6.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+cos(u_time+p6.y))*sin(u_time*1.2)*0.7       : sin(u_time+sin(u_time+p6.y))* (easy_random(p6.xy));
//    p6.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+sin(u_time+p6.z*p6.y))*cos(u_time*0.85)*0.7 : cos(u_time+cos(u_time+p6.x))* (easy_random(p6.xy));
    p6 = p6 * rotateX(TWO_PI/8.);
    vec4 sp6 = vec4(sp_color, sphereSDF(p6, 0.35) + 0.02 * (sin(40.0*p6.x)) * (sin(40.0*p6.y)) * (cos(40.0*p6.z)));
    p6.xy = repeatAng(p6.xy, 3.0);
    float cy_6 = cylinderSDF(p6.xzy, cy_h, cy_w);
    vec4 cy6 = vec4(cy_color, cy_6);
    cy6 = unionWithSmoothSDF(cy6, sp6, 10.0);
    
    // seventh set of the cyclinders
    vec3 p7 = samplePoint+vec3(0.0, 0.0, cos(u_time*0.5)*sin(u_time*0.5));
    p7.x += sin(u_time+cos(u_time+p7.y))*abs(cos(u_time*1.1))*0.72 * step1;
    p7.x += sin(u_time+sin(u_time+p7.y))* (easy_random(p7.xy)) * step2;
    p7.y += cos(u_time+sin(u_time+p7.z))*abs(sin(u_time*1.15))*0.725 * step1;
    p7.y += cos(u_time+cos(u_time+p7.x))* (easy_random(p7.xy)) * step2;
//    p7.x += mod(u_time*0.1, 2.0) < 1.0 ? sin(u_time+cos(u_time+p7.y))*abs(cos(u_time*1.1))*0.72   : sin(u_time+sin(u_time+p7.y))* (easy_random(p7.xy));
//    p7.y += mod(u_time*0.1, 2.0) < 1.0 ? cos(u_time+sin(u_time+p7.z))*abs(sin(u_time*1.15))*0.725 : cos(u_time+cos(u_time+p7.x))* (easy_random(p7.xy));
    p7 = p7 * rotateX(-TWO_PI/8.);
    vec4 sp7 = vec4(sp_color, sphereSDF(p7, 0.35) + 0.02 * (sin(40.0*p7.x)) * (sin(40.0*p7.y)) * (cos(40.0*p7.z)));
    p7.xy = repeatAng(p7.xy, 3.0);
    float cy_7 = cylinderSDF(p7.xzy, cy_h, cy_w);
    vec4 cy7 = vec4(cy_color, cy_7);
    cy7 = unionWithSmoothSDF(cy7, sp7, 10.0);
    
    neuron = unionSDF2(cy1, cy2);
    neuron = unionSDF2(neuron, cy3);
    neuron = unionSDF2(neuron, cy4);
    neuron = unionSDF2(neuron, cy5);
    neuron = unionSDF2(neuron, cy6);
    neuron = unionSDF2(neuron, cy7);
    
    return neuron;
}

// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <basic function> //

vec3 rayDirection(float fieldOfView) {
    vec2 xy = gl_FragCoord.xy - u_resolution / 2.0;
    float z = u_resolution.y / tan(radians(fieldOfView)/2.0);
    return normalize(vec3(xy, -z));
}

vec2 shortestDistanceToSurface2(vec3 eye, vec3 marchingDirection, float start, float end) {
    vec2 depth;
    vec2 max = vec2(end);
    depth.x = start;
    for ( int i = 0; i < MAX_MARCHING_STEPS; i++ ) {
        depth.y = sceneSDF2( eye + depth.x * marchingDirection ).w;
        
        if ( depth.y < EPSILON ) {
            return depth;
        }
        
        depth.x += depth.y;
        
        if ( depth.x >= max.x ) {
            return max;
        }
    }
    return max;
}

// SDFの勾配を求めて、各ポイントにおける法線を算出。
vec3 estimateNormal(vec3 p) {
    return normalize(vec3(
                          sceneSDF2(vec3(p.x + EPSILON, p.y, p.z)).w - sceneSDF2(vec3(p.x - EPSILON, p.y, p.z)).w,
                          sceneSDF2(vec3(p.x, p.y + EPSILON, p.z)).w - sceneSDF2(vec3(p.x, p.y - EPSILON, p.z)).w,
                          sceneSDF2(vec3(p.x, p.y, p.z + EPSILON)).w - sceneSDF2(vec3(p.x, p.y, p.z - EPSILON)).w
                          ));
}

// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <lighting function> //

vec3 phongContribForLight(vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye, vec3 lightPos, vec3 lightIntensity) {
    vec3 N = estimateNormal(p); // N : Normal
    vec3 L = normalize(lightPos-p); // L : pから光源方向へのベクトル
    vec3 R = normalize(reflect(-L, N)); // R : 反射ベクトル（光源から点pに向かって放たられる光に対する反射）
    vec3 V = normalize(eye-p); // pから目線（カメラ位置）方向へのベクトル
    
    float dotLN = dot(L, N); // ベクトルLとNの内積を計算
    float dotRV = dot(R, V); // ベクトルRとVの内積を計算
    
    if ( dotLN < 0.0 ) {
        // もし内積が０以下、つまり二つのベクトルが９０以上開いていたらライトを消す（0を返す）
        return vec3 (0.0, 0.0, 0.0);
    }
    if ( dotRV < 0.0 ) {
        // pから目線方向へのベクトルと反射ベクトルの角度が９０以上開いていたらdiffuseのみを適用する
        return lightIntensity * (k_d*dotLN);
    }
    return lightIntensity * (k_d*dotLN+k_s*pow(dotRV, alpha));
}

vec3 phongillumination(vec3 k_a, vec3 k_d, vec3 k_s, float alpha, vec3 p, vec3 eye, vec2 dist ) {
    const vec3 ambientLight = 0.5 * vec3(1.0, 1.0, 1.0);
    vec3 color = ambientLight * k_a;
    vec3 light1Pos = vec3(4.0*sin(u_time),
                          2.0,
                          4.0*cos(u_time));
    vec3 light1Intensity = vec3(0.4, 0.4, 0.4);
    color += phongContribForLight(k_d, k_s, alpha, p, eye, light1Pos, light1Intensity);

    float shadow = 1.0;
    
    return color * max(shadow, 0.5);
}

mat4 viewMatrix(vec3 eye, vec3 center, vec3 up) {
    vec3 f = normalize( center - eye );
    vec3 s = normalize( cross(f, up) );
    vec3 u = cross(s, f);
    return mat4 (
                 vec4(s, 0.0),
                 vec4(u, 0.0),
                 vec4(-f, 0.0),
                 vec4(0.0, 0.0, 0.0, 1.0)
                 );
}


// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// ------------------------------------------------------------------------------------------------------------------------------------- //
// <main> //

void main () {
    // スクリーン座標を上下左右を-1~1にする (左下が-1, -1で右上が1,1)
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // fieldOfViewの角度を渡してレイを作成
    vec3 viewDir = rayDirection(45.0);
    //    vec3 viewDir = rayDirection2(st, 45.0);
    
    // カメラの位置を決める
    //    vec3 eye = vec3(8.0, sin(u_time*0.2)*5.0, 7.0);
    //    vec3 eye = vec3(8.0, 4.0, 5.0);
    vec3 eye = vec3(cos(u_time*0.3)*10.0, 0.0, sin(u_time*0.3)*10.0);
//    vec3 eye = vec3(0.0, 0.0, 15.0);

    mat4 viewToWorld = viewMatrix(eye, vec3(0.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0));
    vec3 worldDir = (viewToWorld * vec4(viewDir, 0.0)).xyz;
    
    vec2 dist = shortestDistanceToSurface2( eye, worldDir, MIN_DIST, MAX_DIST );

    vec3 surfPos = eye + dist.x * worldDir;
    
    vec3 K_a = sceneSDF2(surfPos).rgb;
    vec3 K_d = sceneSDF2(surfPos).rgb;
    vec3 K_s = vec3(1.0, 1.0, 1.0);
    float shininess = 10.0;
    
    vec3 color = phongillumination( K_a, K_d, K_s, shininess, surfPos, eye, dist );
    
    if( dist.x > MAX_DIST - EPSILON ) {
        outputColor = vec4(0.0);
        return;
    }
    
    outputColor = vec4(color, 1.0);
    outputColor += vec4(2.0, 1.0, 0.0, 0.5) * (MAX_DIST - dist.x) * 0.002;
//    outputColor += vec4(2.0, 0.0, 0.0, 0.5) * (MAX_DIST - dist.x) * 0.002;
}
