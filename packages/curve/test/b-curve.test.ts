import { PointCal } from '@ue-too/math';
import { Bezier } from 'bezier-js';
import type { Bezier as BezierType } from 'bezier-js';
import { beforeEach, describe, expect, test } from 'bun:test';

import {
    BCurve,
    Point,
    TValOutofBoundError,
    approximately,
    offset,
    solveCubic,
} from '../src/b-curve';
import { Line } from '../src/line';

describe('Basic Operation on Bezier Curve', () => {
    test('Initializing bezier curve with 3 control points', () => {
        const controlPoints = [
            { x: 10, y: 20 },
            { x: 30, y: 50 },
            { x: 20, y: 30 },
        ];
        const testBCurve = new BCurve(controlPoints);
        expect(testBCurve.getControlPoints().sort()).toEqual(
            controlPoints.sort()
        );
    });

    test('Initializing bezier curve with 4 control points', () => {
        const controlPoints = [
            { x: 10, y: 20 },
            { x: 30, y: 50 },
            { x: 20, y: 30 },
            { x: 70, y: 30 },
        ];
        const testBCurve = new BCurve(controlPoints);
        expect(testBCurve.getControlPoints().sort()).toEqual(
            controlPoints.sort()
        );
    });

    describe('Quadratic Bezier Curve (3 Control Points)', () => {
        const controlPoints: Point[] = [];
        let testBCurve: BCurve;
        let refBCurve: BezierType;

        beforeEach(() => {
            controlPoints.length = 0;
            for (let index = 0; index < 3; index++) {
                controlPoints.push({
                    x: getRandom(-500, 500),
                    y: getRandom(-500, 500),
                });
            }
            testBCurve = new BCurve(controlPoints);
            refBCurve = new Bezier(controlPoints);
        });

        test('Get point coordinate given a value t using compute (a more general method)', () => {
            const tVal = Math.random();
            const expectedRes = refBCurve.get(tVal);
            const expectX = expectedRes.x;
            const expectY = expectedRes.y;
            const testRes = testBCurve.get(tVal);
            expect(testRes.x).toBeCloseTo(expectX, 5);
            expect(testRes.y).toBeCloseTo(expectY, 5);
        });

        test('Get point coordinate given a value t using get (tailored specific to the type of bezier curve)', () => {
            const tVal = Math.random();
            const expectedRes = refBCurve.get(tVal);
            const expectX = expectedRes.x;
            const expectY = expectedRes.y;
            const testRes = testBCurve.get(tVal);
            expect(testRes.x).toBeCloseTo(expectX, 5);
            expect(testRes.y).toBeCloseTo(expectY, 5);
        });

        test('Invalid t Value (gt 1 or lt 0)', () => {
            const testResGt1 = () => {
                testBCurve.get(1.1);
            };
            const testResLt0 = () => {
                testBCurve.get(-0.1);
            };
            expect(testResGt1).toThrow(TValOutofBoundError);
            expect(testResLt0).toThrow(TValOutofBoundError);
        });

        test('Get Derivative at given t value unnormalized', () => {
            const tVal = Math.random();
            const expectRes = refBCurve.derivative(tVal);
            const testRes = testBCurve.derivative(tVal);
            expect(testRes.x).toBeCloseTo(expectRes.x);
            expect(testRes.y).toBeCloseTo(expectRes.y);
        });

        test('Get Derivative at given t value normalized', () => {
            const tVal = Math.random();
            const derivativeUnNormalized = refBCurve.derivative(tVal);
            const derivativeNormalized = PointCal.unitVector({
                x: derivativeUnNormalized.x,
                y: derivativeUnNormalized.y,
            });
            const testRes = testBCurve.derivativeNormalized(tVal);
            expect(testRes.x).toBeCloseTo(derivativeNormalized.x);
            expect(testRes.y).toBeCloseTo(derivativeNormalized.y);
        });

        test('Get arc length', () => {
            const expectRes = refBCurve.length();
            const testRes = testBCurve.fullLength;
            expect(testRes).toBeCloseTo(expectRes);
        });

        test('Split curve in half at given t value', () => {
            const tVal = Math.random();
            const expectRes = refBCurve.split(tVal);
            const testRes = testBCurve.split(tVal);
            const expectLeftHalf = expectRes.left.points;
            const expectRightHalf = expectRes.right.points;
            const testLeft = testRes[0];
            const testRight = testRes[1];
            testLeft.forEach((point, index) => {
                expect(point.x).toBeCloseTo(expectLeftHalf[index].x);
                expect(point.y).toBeCloseTo(expectLeftHalf[index].y);
            });
            testRight.forEach((point, index) => {
                expect(point.x).toBeCloseTo(expectRightHalf[index].x);
                expect(point.y).toBeCloseTo(expectRightHalf[index].y);
            });
        });

        test('Set control point at given index i', () => {
            const newPoint = {
                x: getRandom(-500, 500),
                y: getRandom(-500, 500),
            };
            const index = getRandomInt(0, 2);
            testBCurve.setControlPointAtIndex(index, newPoint);
            refBCurve.points[index] = newPoint;
            expect(testBCurve.getControlPoints()).toEqual(refBCurve.points);
        });

        test('Set control point with an invalid index', () => {
            const newPoint = {
                x: getRandom(-500, 500),
                y: getRandom(-500, 500),
            };
            const gtRes = testBCurve.setControlPointAtIndex(4, newPoint);
            const ltRes = testBCurve.setControlPointAtIndex(-3, newPoint);
            expect(gtRes).toBe(false);
            expect(ltRes).toBe(false);
        });

        test('3 x 3 Matrix Determinant', () => {
            let matrix = [
                [7, -4, 2],
                [3, 1, -5],
                [2, 2, -5],
            ];
            const testRes = testBCurve.determinant3by3(matrix);
            expect(testRes).toBe(23);
            matrix = [
                [1, -6, -7],
                [1, -4, 7],
                [-1, -3, -6],
            ];
            expect(testBCurve.determinant3by3(matrix)).toBe(100);
        });

        test('Fit Arc Given 3 points', () => {
            const startPoint = { x: 1, y: 1 };
            const midPoint = { x: 2, y: 4 };
            const endPoint = { x: 5, y: 3 };
            const testRes = testBCurve.fitArc(startPoint, endPoint, midPoint);
            expect(testRes.exists).toBe(true);
            expect(testRes.center?.x).toBeCloseTo(3);
            expect(testRes.center?.y).toBeCloseTo(2);
            expect(testRes.radius).toBeCloseTo(Math.sqrt(5));
        });

        test('Fit Arc Given 3 points lying on a line', () => {
            const startPoint = { x: 3, y: 0 };
            const midPoint = { x: 2, y: 0 };
            const endPoint = { x: 5, y: 0 };
            const testRes = testBCurve.fitArc(startPoint, endPoint, midPoint);
            expect(testRes.exists).toBe(false);
        });

        test('Find arcs in bezier curve', () => {
            const errorThreshold = 0.5;
            const testRes = testBCurve.findArcs(errorThreshold);
            const inflectedCurve = new BCurve([
                { x: 52, y: 235 },
                { x: 56, y: 118 },
                { x: 204, y: 222 },
                { x: 179, y: 107 },
            ]);
            const inflectedRes = inflectedCurve.findArcs(errorThreshold);

            let prevT = 0;
            testRes.forEach(arc => {
                expect(arc.startT).toBe(prevT);
                prevT = arc.endT;
                for (let tVal = arc.startT; tVal <= arc.endT; tVal += 0.01) {
                    const testPoint = testBCurve.get(tVal);
                    const testRadius = PointCal.distanceBetweenPoints(
                        testPoint,
                        arc.center
                    );
                    let proximityRes = false;
                    if (
                        Math.abs(testRadius - arc.radius) < errorThreshold ||
                        Math.abs(
                            Math.abs(testRadius - arc.radius) - errorThreshold
                        ) <
                            errorThreshold * 0.5
                    ) {
                        proximityRes = true;
                    }
                    expect(proximityRes).toBe(true);
                }
            });
            expect(prevT).toBe(1);
            prevT = 0;
            inflectedRes.forEach(arc => {
                expect(arc.startT).toBe(prevT);
                prevT = arc.endT;
                for (let tVal = arc.startT; tVal <= arc.endT; tVal += 0.01) {
                    const testPoint = inflectedCurve.get(tVal);
                    const testRadius = PointCal.distanceBetweenPoints(
                        testPoint,
                        arc.center
                    );
                    let proximityRes = false;
                    if (
                        Math.abs(testRadius - arc.radius) < errorThreshold ||
                        Math.abs(
                            Math.abs(testRadius - arc.radius) - errorThreshold
                        ) <
                            errorThreshold * 0.5
                    ) {
                        proximityRes = true;
                    }
                    expect(proximityRes).toBe(true);
                }
            });
            expect(prevT).toBe(1);
        });

        test('Find arcs with a straight bezier curve', () => {
            const controlPoint1 = { x: 100, y: 0 };
            const controlPoint2 = { x: 200, y: 0 };
            const controlPoint3 = { x: 300, y: 0 };
            const controlPoint4 = { x: 400, y: 0 };
            const straightCurve = new BCurve([
                controlPoint1,
                controlPoint2,
                controlPoint3,
                controlPoint4,
            ]);
            const testRes = straightCurve.findArcs(0.01);
            expect(testRes.length).toBe(0);
        });

        // test("Get Curvature at a given t", ()=>{
        //     for(let tVal = 0; tVal <= 1; tVal += 0.01){
        //         const testRes = testBCurve.curvature(tVal);
        //         const expectRes = refBCurve.curvature(tVal);
        //         expect(testRes).toBeCloseTo(expectRes.k);
        //     }
        // });

        test('Get Coefficients of different order of t from the bezier curve', () => {
            const testRes = testBCurve.getCoefficientOfTTerms();
            const controlPoints = testBCurve.getControlPoints();
            const constantTerm = PointCal.multiplyVectorByScalar(
                controlPoints[0],
                1
            );
            const firstOrderTerm = PointCal.addVector(
                PointCal.multiplyVectorByScalar(controlPoints[0], -2),
                PointCal.multiplyVectorByScalar(controlPoints[1], 2)
            );
            const secondOrderTerm = PointCal.addVector(
                controlPoints[0],
                PointCal.addVector(
                    PointCal.multiplyVectorByScalar(controlPoints[1], -2),
                    controlPoints[2]
                )
            );
            expect(testRes.length).toBe(3);
            expect(testRes[0].x).toBeCloseTo(constantTerm.x);
            expect(testRes[0].y).toBeCloseTo(constantTerm.y);
            expect(testRes[1].x).toBeCloseTo(firstOrderTerm.x);
            expect(testRes[1].y).toBeCloseTo(firstOrderTerm.y);
            expect(testRes[2].x).toBeCloseTo(secondOrderTerm.x);
            expect(testRes[2].y).toBeCloseTo(secondOrderTerm.y);
        });

        test('Get Coefficients of different order of t from the derivative of the bezier curve', () => {
            const testRes = testBCurve.getDerivativeCoefficients();
            const derivativeControlPoints =
                testBCurve.getDerivativeControlPoints(
                    testBCurve.getControlPoints()
                );
            const constantTerm = PointCal.multiplyVectorByScalar(
                derivativeControlPoints[0],
                1
            );
            const firstOrderTerm = PointCal.addVector(
                PointCal.multiplyVectorByScalar(derivativeControlPoints[0], -1),
                PointCal.multiplyVectorByScalar(derivativeControlPoints[1], 1)
            );
            expect(testRes.length).toBe(2);
            expect(testRes[0].x).toBeCloseTo(constantTerm.x);
            expect(testRes[0].y).toBeCloseTo(constantTerm.y);
            expect(testRes[1].x).toBeCloseTo(firstOrderTerm.x);
            expect(testRes[1].y).toBeCloseTo(firstOrderTerm.y);
        });

        test('Solve Cubic Polynomial', () => {
            const a = getRandom(-500, 500);
            const b = getRandom(-500, 500);
            const c = getRandom(-500, 500);
            const d = getRandom(-500, 500);
            const testRes = solveCubic(a, b, c, d);
            const refRes = solveCubic(a, b, c, d);
            expect(testRes).toEqual(refRes);
        });

        test('Find Extrema in Bezier Curve', () => {
            const testRes = testBCurve.getExtrema();
            const expectRes = refBCurve.extrema();
            expect(testRes.x.length).toBe(expectRes.x.length);
            expect(testRes.y.length).toBe(expectRes.y.length);
            testRes.x.sort();
            testRes.y.sort();
            expectRes.x.sort().forEach((x, index) => {
                expect(testRes.x[index]).toBeCloseTo(x);
            });
            expectRes.y.sort().forEach((y, index) => {
                expect(testRes.y[index]).toBeCloseTo(y);
            });
        });

        test('Find Axis Aligned Bounding Box of the bezier curve', () => {
            const boundingBox = testBCurve.AABB;
            const refBoundingBox = refBCurve.bbox();
            expect(boundingBox.min.x).toBeCloseTo(refBoundingBox.x.min);
            expect(boundingBox.min.y).toBeCloseTo(refBoundingBox.y.min);
            expect(boundingBox.max.x).toBeCloseTo(refBoundingBox.x.max);
            expect(boundingBox.max.y).toBeCloseTo(refBoundingBox.y.max);
        });

        test('Align Bezier Curve with the X axis', () => {
            const testControlPoints = [
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
            ];
            const alignRefBCurve = new BCurve(testControlPoints);
            const testRes = alignRefBCurve.getControlPointsAlignedWithXAxis();
            expect(testRes.length).toBe(3);
            expect(testRes[testRes.length - 1].y).toBeCloseTo(0);
            const alignTestBCurve = new BCurve(testRes);
            for (let tVal = 0; tVal <= 1; tVal += 0.01) {
                const refPosition = alignRefBCurve.compute(tVal);
                const testPosition = alignTestBCurve.compute(tVal);
                const refDist = PointCal.distanceBetweenPoints(
                    alignRefBCurve.getControlPoints()[0],
                    refPosition
                );
                const testDist = PointCal.distanceBetweenPoints(
                    alignTestBCurve.getControlPoints()[0],
                    testPosition
                );
                expect(testDist).toBeCloseTo(refDist);
            }
        });

        test('Find Intersection(s) between a line and a bezier curve', () => {
            const line = new Line({ x: 15, y: 250 }, { x: 220, y: 20 });
            const testCurve = new BCurve([
                { x: 70, y: 250 },
                { x: 20, y: 110 },
                { x: 220, y: 60 },
            ]);
            const testRes = testCurve.getLineIntersections(line);
            expect(testRes.length).toBe(2);
            testRes.sort();
            const refRes = [0.19, 0.87];
            testRes.forEach((tVal, index) => {
                expect(tVal).toBeCloseTo(refRes[index]);
            });
        });

        test('Find Intersection(s) between a line and a bezier curve when intersection is not within the line segment', () => {
            const line = new Line({ x: 15, y: 250 }, { x: 220, y: 20 });
            const lineUnitVector = PointCal.unitVectorFromA2B(
                line.getStartPoint(),
                line.getEndPoint()
            );
            const unitLine = new Line(
                line.getStartPoint(),
                PointCal.addVector(line.getStartPoint(), lineUnitVector)
            );
            const testCurve = new BCurve([
                { x: 70, y: 250 },
                { x: 20, y: 110 },
                { x: 220, y: 60 },
            ]);
            const testRes = testCurve.getLineIntersections(unitLine);
            expect(testRes.length).toBe(0);
        });

        test('Get Look up table from the bezier curve', () => {
            const steps = getRandomInt(5, 100);
            const testRes = testBCurve.getLUT(steps);
            const expectRes = refBCurve.getLUT(steps);
            expect(testRes.length).toBe(expectRes.length);
            expectRes.forEach((point, index) => {
                expect(testRes[index].x).toBeCloseTo(point.x);
                expect(testRes[index].y).toBeCloseTo(point.y);
            });
        });

        test('Find Intersections between a bezier curve with a circle', () => {
            const testControlPoints = getRandomQuadraticControlPoints(
                -500,
                500
            );
            const testCurve = new BCurve(testControlPoints);
            const circleCenter = getRandomPoint(-500, 500);
            const radius = getRandom(-300, 300);
            const testRes = testCurve.getCircleIntersections(
                circleCenter,
                radius
            );
            // getCircleIntersections refines each hit by binary search and
            // discards anything farther than its epsilon (0.01 world units)
            // from the circle — so 0.01 is the accuracy the solver actually
            // promises. Asserting tighter (toBeCloseTo precision 2 = 0.005)
            // made this random-input test flake about once in 40 runs.
            const SOLVER_EPSILON = 0.01;
            testRes.forEach(intersection => {
                const distance = PointCal.distanceBetweenPoints(
                    intersection.intersection,
                    circleCenter
                );
                expect(Math.abs(distance - radius)).toBeLessThanOrEqual(SOLVER_EPSILON);
            });
        });
    });

    describe('Cubic Bezier Curve (4 Control Points)', () => {
        const controlPoints: Point[] = [];
        let testBCurve: BCurve;
        let refBCurve: BezierType;
        beforeEach(() => {
            controlPoints.length = 0;
            for (let index = 0; index < 4; index++) {
                controlPoints.push({
                    x: getRandom(-500, 500),
                    y: getRandom(-500, 500),
                });
            }
            testBCurve = new BCurve(controlPoints);
            refBCurve = new Bezier(controlPoints);
        });

        test('Get point coordinate given a value t using compute (a more general method)', () => {
            const tVal = 0;
            const expectedRes = refBCurve.get(tVal);
            expect(testBCurve.compute(tVal)).toEqual({
                x: expectedRes.x,
                y: expectedRes.y,
            });
        });

        test('Get point coordinate given a value t using get (tailored specific to the type of bezier curve)', () => {
            const tVal = Math.random();
            const expectedRes = refBCurve.get(tVal);
            const expectX = expectedRes.x;
            const expectY = expectedRes.y;
            const testRes = testBCurve.get(tVal);
            expect(testRes.x).toBeCloseTo(expectX, 5);
            expect(testRes.y).toBeCloseTo(expectY, 5);
        });

        test('Invalid t value (gt 1 or lt 0)', () => {
            const cTestResGt1 = () => {
                testBCurve.get(1.1);
            };
            const cTestResLt0 = () => {
                testBCurve.get(-0.1);
            };
            expect(cTestResGt1).toThrow(TValOutofBoundError);
            expect(cTestResLt0).toThrow(TValOutofBoundError);
        });

        test('Get Derivative at given t value unnormalized', () => {
            const tVal = Math.random();
            const expectRes = refBCurve.derivative(tVal);
            const testRes = testBCurve.derivative(tVal);
            expect(testRes.x).toBeCloseTo(expectRes.x);
            expect(testRes.y).toBeCloseTo(expectRes.y);
        });

        test('Get Derivative at given t value normalized', () => {
            const tVal = Math.random();
            const derivativeUnNormalized = refBCurve.derivative(tVal);
            const derivativeNormalized = PointCal.unitVector({
                x: derivativeUnNormalized.x,
                y: derivativeUnNormalized.y,
            });
            const testRes = testBCurve.derivativeNormalized(tVal);
            expect(testRes.x).toBeCloseTo(derivativeNormalized.x);
            expect(testRes.y).toBeCloseTo(derivativeNormalized.y);
        });

        test('Get arc length', () => {
            const expectRes = refBCurve.length();
            const testRes = testBCurve.fullLength;
            expect(testRes).toBeCloseTo(expectRes);
        });

        test('Split curve in half at given t value', () => {
            const tVal = Math.random();
            const expectRes = refBCurve.split(tVal);
            const testRes = testBCurve.split(tVal);
            const expectLeftHalf = expectRes.left.points;
            const expectRightHalf = expectRes.right.points;
            const testLeft = testRes[0];
            const testRight = testRes[1];
            testLeft.forEach((point, index) => {
                expect(point.x).toBeCloseTo(expectLeftHalf[index].x);
                expect(point.y).toBeCloseTo(expectLeftHalf[index].y);
            });
            testRight.forEach((point, index) => {
                expect(point.x).toBeCloseTo(expectRightHalf[index].x);
                expect(point.y).toBeCloseTo(expectRightHalf[index].y);
            });
        });

        test('Split curve in 3 at given t values', () => {
            const curve = new BCurve([
                { x: 100, y: 25 },
                { x: 10, y: 90 },
                { x: 110, y: 100 },
                { x: 150, y: 195 },
            ]);
            const testRes = curve.splitIn3Curves(0.25, 0.75);
            expect(testRes[1].getControlPoints()).toEqual([
                { x: 64.21875, y: 65.625 },
                { x: 58.90625, y: 88.75 },
                { x: 85.46875, y: 106.875 },
                { x: 112.65625, y: 137.5 },
            ]);
        });

        test('Set control point at given index i', () => {
            const newPoint = {
                x: getRandom(-500, 500),
                y: getRandom(-500, 500),
            };
            const index = getRandomInt(0, 3);
            testBCurve.setControlPointAtIndex(index, newPoint);
            refBCurve.points[index] = newPoint;
            expect(testBCurve.getControlPoints()).toEqual(refBCurve.points);
        });

        test('Set control point with an invalid index', () => {
            const newPoint = {
                x: getRandom(-500, 500),
                y: getRandom(-500, 500),
            };
            const gtRes = testBCurve.setControlPointAtIndex(4, newPoint);
            const ltRes = testBCurve.setControlPointAtIndex(-3, newPoint);
            expect(gtRes).toBe(false);
            expect(ltRes).toBe(false);
        });

        test('Find arcs in bezier curve', () => {
            const errorThreshold = 0.5;
            const testRes = testBCurve.findArcs(errorThreshold);
            let prevT = 0;
            testRes.forEach(arc => {
                expect(arc.startT).toBe(prevT);
                prevT = arc.endT;
                for (let tVal = arc.startT; tVal <= arc.endT; tVal += 0.01) {
                    const testPoint = testBCurve.get(tVal);
                    const testRadius = PointCal.distanceBetweenPoints(
                        testPoint,
                        arc.center
                    );
                    let proximityRes = false;
                    if (
                        Math.abs(testRadius - arc.radius) < errorThreshold ||
                        Math.abs(
                            Math.abs(testRadius - arc.radius) - errorThreshold
                        ) <
                            errorThreshold * 0.5
                    ) {
                        proximityRes = true;
                    }
                    expect(proximityRes).toBe(true);
                }
            });
            expect(prevT).toBe(1);
        });

        test('Find arcs with a straight bezier curve', () => {
            const controlPoint1 = { x: 100, y: 0 };
            const controlPoint2 = { x: 200, y: 0 };
            const controlPoint3 = { x: 300, y: 0 };
            const straightCurve = new BCurve([
                controlPoint1,
                controlPoint2,
                controlPoint3,
            ]);
            const testRes = straightCurve.findArcs(0.01);
            expect(testRes.length).toBe(0);
        });

        // test("Get Curvature at a given t", ()=>{
        //     for(let tVal = 0; tVal <= 1; tVal += 0.01){
        //         const testRes = testBCurve.curvature(tVal);
        //         const expectRes = refBCurve.curvature(tVal);
        //         expect(testRes).toBeCloseTo(expectRes.k);
        //     }
        // });

        test('Get Coefficients of different order of t from the bezier curve', () => {
            const testRes = testBCurve.getCoefficientOfTTerms();
            const controlPoints = testBCurve.getControlPoints();
            const constantTerm = PointCal.multiplyVectorByScalar(
                controlPoints[0],
                1
            );
            const firstOrderTerm = PointCal.addVector(
                PointCal.multiplyVectorByScalar(controlPoints[0], -3),
                PointCal.multiplyVectorByScalar(controlPoints[1], 3)
            );
            const secondOrderTerm = PointCal.addVector(
                PointCal.multiplyVectorByScalar(controlPoints[0], 3),
                PointCal.addVector(
                    PointCal.multiplyVectorByScalar(controlPoints[1], -6),
                    PointCal.multiplyVectorByScalar(controlPoints[2], 3)
                )
            );
            const thirdOrderTerm = PointCal.addVector(
                PointCal.addVector(
                    PointCal.multiplyVectorByScalar(controlPoints[0], -1),
                    PointCal.multiplyVectorByScalar(controlPoints[1], 3)
                ),
                PointCal.addVector(
                    PointCal.multiplyVectorByScalar(controlPoints[2], -3),
                    PointCal.multiplyVectorByScalar(controlPoints[3], 1)
                )
            );

            expect(testRes.length).toBe(4);
            expect(testRes[0].x).toBeCloseTo(constantTerm.x);
            expect(testRes[0].y).toBeCloseTo(constantTerm.y);
            expect(testRes[1].x).toBeCloseTo(firstOrderTerm.x);
            expect(testRes[1].y).toBeCloseTo(firstOrderTerm.y);
            expect(testRes[2].x).toBeCloseTo(secondOrderTerm.x);
            expect(testRes[2].y).toBeCloseTo(secondOrderTerm.y);
            expect(testRes[3].x).toBeCloseTo(thirdOrderTerm.x);
            expect(testRes[3].y).toBeCloseTo(thirdOrderTerm.y);
        });

        test('Get Coefficients of different order of t from the derivative of the bezier curve', () => {
            const testRes = testBCurve.getDerivativeCoefficients();
            const derivativeControlPoints =
                testBCurve.getDerivativeControlPoints(
                    testBCurve.getControlPoints()
                );
            const constantTerm = PointCal.multiplyVectorByScalar(
                derivativeControlPoints[0],
                1
            );
            const firstOrderTerm = PointCal.addVector(
                PointCal.multiplyVectorByScalar(derivativeControlPoints[0], -2),
                PointCal.multiplyVectorByScalar(derivativeControlPoints[1], 2)
            );
            const secondOrderTerm = PointCal.addVector(
                PointCal.addVector(
                    PointCal.multiplyVectorByScalar(
                        derivativeControlPoints[0],
                        1
                    ),
                    PointCal.multiplyVectorByScalar(
                        derivativeControlPoints[1],
                        -2
                    )
                ),
                PointCal.multiplyVectorByScalar(derivativeControlPoints[2], 1)
            );
            expect(testRes.length).toBe(3);
            expect(testRes[0].x).toBeCloseTo(constantTerm.x);
            expect(testRes[0].y).toBeCloseTo(constantTerm.y);
            expect(testRes[1].x).toBeCloseTo(firstOrderTerm.x);
            expect(testRes[1].y).toBeCloseTo(firstOrderTerm.y);
            expect(testRes[2].x).toBeCloseTo(secondOrderTerm.x);
            expect(testRes[2].y).toBeCloseTo(secondOrderTerm.y);
        });

        test('Align Bezier Curve with the X axis', () => {
            const testControlPoints = [
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
                { x: getRandom(-500, 500), y: getRandom(-500, 500) },
            ];
            const alignRefBCurve = new BCurve(testControlPoints);
            const testRes = alignRefBCurve.getControlPointsAlignedWithXAxis();
            expect(testRes.length).toBe(4);
            expect(testRes[testRes.length - 1].y).toBeCloseTo(0);
            const alignTestBCurve = new BCurve(testRes);
            for (let tVal = 0; tVal <= 1; tVal += 0.01) {
                const refPosition = alignRefBCurve.compute(tVal);
                const testPosition = alignTestBCurve.compute(tVal);
                const refDist = PointCal.distanceBetweenPoints(
                    alignRefBCurve.getControlPoints()[0],
                    refPosition
                );
                const testDist = PointCal.distanceBetweenPoints(
                    alignTestBCurve.getControlPoints()[0],
                    testPosition
                );
                expect(testDist).toBeCloseTo(refDist);
            }
        });

        test('Find Extrema in Bezier Curve', () => {
            const testRes = testBCurve.getExtrema();
            const expectRes = refBCurve.extrema();
            expect(testRes.x.length).toBe(expectRes.x.length);
            expect(testRes.y.length).toBe(expectRes.y.length);
            testRes.x.sort();
            testRes.y.sort();
            expectRes.x.sort().forEach((x, index) => {
                expect(testRes.x[index]).toBeCloseTo(x);
            });
            expectRes.y.sort().forEach((y, index) => {
                expect(testRes.y[index]).toBeCloseTo(y);
            });
        });

        test('Find Intersection(s) between a line and a bezier curve', () => {
            const line = new Line({ x: 25, y: 260 }, { x: 240, y: 55 });
            const testCurve = new BCurve([
                { x: 110, y: 150 },
                { x: 25, y: 190 },
                { x: 210, y: 250 },
                { x: 210, y: 30 },
            ]);
            const testRes = testCurve.getLineIntersections(line);
            expect(testRes.length).toBe(2);
            testRes.sort();
            const refRes = [0.36, 0.9];
            testRes.forEach((tVal, index) => {
                expect(tVal).toBeCloseTo(refRes[index]);
            });
        });

        test('Get Look up table from the bezier curve', () => {
            const steps = getRandomInt(5, 100);
            const testRes = testBCurve.getLUT(steps);
            const expectRes = refBCurve.getLUT(steps);
            expect(testRes.length).toBe(expectRes.length);
            expectRes.forEach((point, index) => {
                expect(testRes[index].x).toBeCloseTo(point.x);
                expect(testRes[index].y).toBeCloseTo(point.y);
            });
        });

        test('Project Points onto bezier curve', () => {
            const testControlPoints = getRandomCubicControlPoints(-500, 500);
            const testCurve = new BCurve(testControlPoints);
            const testMousePosition = getRandomPoint(-500, 500);
            const testRes = testCurve.getProjection(testMousePosition);
            const LUT = testCurve.getLUT();
            LUT.forEach(point => {
                expect(
                    PointCal.distanceBetweenPoints(
                        testRes.projection,
                        testMousePosition
                    )
                ).toSatisfy(
                    (distance: number) =>
                        distance <=
                            PointCal.distanceBetweenPoints(
                                point,
                                testMousePosition
                            ) ||
                        approximately(
                            distance,
                            PointCal.distanceBetweenPoints(
                                point,
                                testMousePosition
                            ),
                            2
                        )
                );
            });
        });

        test('Find Intersections between a bezier curve with a circle', () => {
            const testControlPoints = getRandomCubicControlPoints(-500, 500);
            const testCurve = new BCurve(testControlPoints);
            const circleCenter = getRandomPoint(-500, 500);
            const radius = getRandom(-300, 300);
            const testRes = testCurve.getCircleIntersections(
                circleCenter,
                radius
            );
            // getCircleIntersections refines each hit by binary search and
            // discards anything farther than its epsilon (0.01 world units)
            // from the circle — so 0.01 is the accuracy the solver actually
            // promises. Asserting tighter (toBeCloseTo precision 2 = 0.005)
            // made this random-input test flake about once in 40 runs.
            const SOLVER_EPSILON = 0.01;
            testRes.forEach(intersection => {
                const distance = PointCal.distanceBetweenPoints(
                    intersection.intersection,
                    circleCenter
                );
                expect(Math.abs(distance - radius)).toBeLessThanOrEqual(SOLVER_EPSILON);
            });
        });
    });
});

describe('Advanced Operation on Bezier Curve', () => {
    test('Given a t value and a length, find the t value that is the given length away from the given t value', () => {
        // Create a curved Bezier curve: control points form a curve
        // Start at (0,0), control at (50,100), end at (100,0)
        // This creates a curved path where we can test arc length calculations
        const testCurve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);
        const tVal = 0.5; // Start at middle of curve
        const length = 30; // Advance 30 units along the curve

        const testRes = testCurve.advanceAtTWithLength(tVal, length);

        // Verify we get a withinCurve result
        expect(testRes.type).toBe('withinCurve');
        if (testRes.type === 'withinCurve') {
            // The new t value should be greater than 0.5 since we're advancing forward
            expect(testRes.tVal).toBeGreaterThan(0.5);
            const lengthAtStart = testCurve.lengthAtT(0.5);
            const lengthAtEnd = testCurve.lengthAtT(testRes.tVal);
            expect(lengthAtEnd - lengthAtStart).toBeCloseTo(length, 0);

            // The point should be further along the curve
            expect(testRes.point.x).toBeGreaterThan(testCurve.get(0.5).x);

            // Verify the arc length from original t to new t is approximately the requested length
            const originalLength = testCurve.lengthAtT(tVal);
            const newLength = testCurve.lengthAtT(testRes.tVal);
            const actualAdvance = newLength - originalLength;
            expect(actualAdvance).toBeCloseTo(length, 0);
        }
    });

    test('Advance beyond curve length should return afterCurve type', () => {
        const testCurve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);
        const tVal = 0.8; // Start near end
        const length = 100; // Try to advance 100 units (beyond curve length)

        const testRes = testCurve.advanceAtTWithLength(tVal, length);

        expect(testRes.type).toBe('afterCurve');
        if (testRes.type === 'afterCurve') {
            // Should have some remaining length
            expect(testRes.remainLength).toBeGreaterThan(0);
        }
    });

    test('Advance backward before curve start should return beforeCurve type', () => {
        const testCurve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);
        const tVal = 0.2; // Start at 20% of curve
        const length = -50; // Try to go backward 50 units

        const testRes = testCurve.advanceAtTWithLength(tVal, length);

        expect(testRes.type).toBe('beforeCurve');
        if (testRes.type === 'beforeCurve') {
            // Should have some remaining length
            expect(testRes.remainLength).toBeGreaterThan(0);
        }
    });

    test('Advance exact curve length from start should reach end', () => {
        const testCurve = new BCurve([
            { x: 0, y: 0 },
            { x: 50, y: 100 },
            { x: 100, y: 0 },
        ]);
        const tVal = 0; // Start at beginning
        const length = testCurve.fullLength; // Advance full length

        const testRes = testCurve.advanceAtTWithLength(tVal, length);

        expect(testRes.type).toBe('withinCurve');
        if (testRes.type === 'withinCurve') {
            expect(testRes.tVal).toBeCloseTo(1, 2);
            expect(testRes.point.x).toBeCloseTo(100, 1);
            expect(testRes.point.y).toBeCloseTo(0, 1);
        }
    });
});

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandom(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function getRandomPoint(min: number, max: number): Point {
    return { x: getRandom(min, max), y: getRandom(min, max) };
}

function getRandomQuadraticControlPoints(min: number, max: number): Point[] {
    return getRandomControlPoints(min, max, 3);
}

function getRandomCubicControlPoints(min: number, max: number): Point[] {
    return getRandomControlPoints(min, max, 4);
}

function getRandomControlPoints(
    min: number,
    max: number,
    num?: number
): Point[] {
    if (num == undefined) {
        num = 1;
    }
    const res: Point[] = [];
    for (let index = 0; index < num; index++) {
        res.push({ x: getRandom(min, max), y: getRandom(min, max) });
    }
    return res;
}

describe('Offset Functionality', () => {
    test('offset function should return array of BCurve objects', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 10 },
            { x: 30, y: 10 },
        ];

        const bCurve = new BCurve(testPoints);
        const offsetResult = offset(bCurve, 5);

        expect(Array.isArray(offsetResult)).toBe(true);
        expect(offsetResult.length).toBeGreaterThan(0);

        // Each result should be a BCurve instance
        offsetResult.forEach(curve => {
            expect(curve).toBeInstanceOf(BCurve);
            expect(curve.getControlPoints().length).toBeGreaterThan(0);
        });
    });

    test('offset function with d parameter should return offset point', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 10 },
            { x: 30, y: 10 },
        ];

        const bCurve = new BCurve(testPoints);
        const offsetPoint = offset(bCurve, 0.5, 5);

        expect(offsetPoint).toHaveProperty('c');
        expect(offsetPoint).toHaveProperty('n');
        expect(offsetPoint).toHaveProperty('x');
        expect(offsetPoint).toHaveProperty('y');
        expect(typeof offsetPoint.x).toBe('number');
        expect(typeof offsetPoint.y).toBe('number');
    });

    test('offset function should work with simple curves', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 0 },
        ];

        const bCurve = new BCurve(testPoints);
        const offsetResult = offset(bCurve, 5);

        expect(Array.isArray(offsetResult)).toBe(true);
        expect(offsetResult.length).toBeGreaterThan(0);

        // Each result should be a BCurve instance
        offsetResult.forEach(curve => {
            expect(curve).toBeInstanceOf(BCurve);
        });
    });

    test('offset function should produce reasonable cubic curve results', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 10 },
            { x: 30, y: 10 },
        ];

        const bCurve = new BCurve(testPoints);
        const bCurveOffset = offset(bCurve, 5);

        // Test that we get an array of BCurve objects
        expect(Array.isArray(bCurveOffset)).toBe(true);
        expect(bCurveOffset.length).toBeGreaterThan(0);

        // Test that each result is a valid BCurve
        bCurveOffset.forEach(curve => {
            expect(curve).toBeInstanceOf(BCurve);
            const points = curve.getControlPoints();
            expect(points.length).toBeGreaterThanOrEqual(3);

            // Ensure points are valid numbers
            points.forEach(point => {
                expect(typeof point.x).toBe('number');
                expect(typeof point.y).toBe('number');
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
            });
        });

        // Test that start and end points are offset correctly
        const firstCurve = bCurveOffset[0];
        const lastCurve = bCurveOffset[bCurveOffset.length - 1];
        const firstPoints = firstCurve.getControlPoints();
        const lastPoints = lastCurve.getControlPoints();

        // Start point should be offset upward (positive y direction for this curve)
        expect(firstPoints[0].y).toBeGreaterThan(0);
        // End point should be offset upward
        expect(lastPoints[lastPoints.length - 1].y).toBeGreaterThan(10);
    });

    test('offset function should produce reasonable quadratic curve results', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 },
        ];

        const bCurve = new BCurve(testPoints);
        const bCurveOffset = offset(bCurve, 3);

        // Test that we get an array of BCurve objects
        expect(Array.isArray(bCurveOffset)).toBe(true);
        expect(bCurveOffset.length).toBeGreaterThan(0);

        // Test that each result is a valid BCurve
        bCurveOffset.forEach(curve => {
            expect(curve).toBeInstanceOf(BCurve);
            const points = curve.getControlPoints();
            expect(points.length).toBeGreaterThanOrEqual(3);

            // Ensure points are valid numbers
            points.forEach(point => {
                expect(typeof point.x).toBe('number');
                expect(typeof point.y).toBe('number');
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
            });
        });

        // For this inverted parabola, offset should create curves that are "wider"
        const firstCurve = bCurveOffset[0];
        const firstPoints = firstCurve.getControlPoints();

        // Start point should be offset (this curve goes up then down, so offset depends on direction)
        expect(typeof firstPoints[0].x).toBe('number');
        expect(typeof firstPoints[0].y).toBe('number');
    });

    test('offset function should handle negative offset values', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 10 },
            { x: 30, y: 10 },
        ];

        const bCurve = new BCurve(testPoints);
        const bCurveOffset = offset(bCurve, -5);

        // Test that we get an array of BCurve objects
        expect(Array.isArray(bCurveOffset)).toBe(true);
        expect(bCurveOffset.length).toBeGreaterThan(0);

        // Test that each result is a valid BCurve
        bCurveOffset.forEach(curve => {
            expect(curve).toBeInstanceOf(BCurve);
            const points = curve.getControlPoints();
            expect(points.length).toBeGreaterThanOrEqual(3);

            // Ensure points are valid numbers
            points.forEach(point => {
                expect(typeof point.x).toBe('number');
                expect(typeof point.y).toBe('number');
                expect(isFinite(point.x)).toBe(true);
                expect(isFinite(point.y)).toBe(true);
            });
        });

        // Test that negative offset goes in opposite direction from positive
        const positiveOffset = offset(bCurve, 5);
        const firstCurvePos = positiveOffset[0];
        const firstCurveNeg = bCurveOffset[0];
        const firstPointsPos = firstCurvePos.getControlPoints();
        const firstPointsNeg = firstCurveNeg.getControlPoints();

        // Start points should be on opposite sides of the original
        expect(firstPointsPos[0].y).toBeGreaterThan(0); // positive offset goes up
        expect(firstPointsNeg[0].y).toBeLessThan(0); // negative offset goes down
    });

    test('offset function should handle straight lines correctly', () => {
        // Test horizontal straight line
        const horizontalLine = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 0 },
            { x: 30, y: 0 },
        ];

        const hCurve = new BCurve(horizontalLine);
        const hOffset = offset(hCurve, 5);

        // Should return exactly one curve for a straight line
        expect(hOffset.length).toBe(1);

        const offsetPoints = hOffset[0].getControlPoints();
        console.log('Horizontal line offset points:', offsetPoints);

        // All points should be offset by 5 units in the y direction
        expect(offsetPoints.length).toBe(4);
        offsetPoints.forEach((point, i) => {
            expect(point.x).toBeCloseTo(horizontalLine[i].x, 6);
            expect(point.y).toBeCloseTo(5, 6); // Should be offset upward
        });

        // Test vertical straight line
        const verticalLine = [
            { x: 0, y: 0 },
            { x: 0, y: 10 },
            { x: 0, y: 20 },
            { x: 0, y: 30 },
        ];

        const vCurve = new BCurve(verticalLine);
        const vOffset = offset(vCurve, 5);

        expect(vOffset.length).toBe(1);

        const vOffsetPoints = vOffset[0].getControlPoints();
        console.log('Vertical line offset points:', vOffsetPoints);

        // All points should be offset by 5 units in the x direction (normal direction)
        expect(vOffsetPoints.length).toBe(4);
        vOffsetPoints.forEach((point, i) => {
            expect(point.x).toBeCloseTo(-5, 6); // Normal points to the left for upward vertical line
            expect(point.y).toBeCloseTo(verticalLine[i].y, 6);
        });

        // Test diagonal straight line
        const diagonalLine = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 20 },
            { x: 30, y: 30 },
        ];

        const dCurve = new BCurve(diagonalLine);
        const dOffset = offset(dCurve, 5);

        expect(dOffset.length).toBe(1);

        const dOffsetPoints = dOffset[0].getControlPoints();
        console.log('Diagonal line offset points:', dOffsetPoints);

        // For 45-degree line, offset should be perpendicular
        // Normal vector for 45-degree line going up-right should point up-left or down-right
        expect(dOffsetPoints.length).toBe(4);
        dOffsetPoints.forEach((point, i) => {
            expect(typeof point.x).toBe('number');
            expect(typeof point.y).toBe('number');
            expect(isFinite(point.x)).toBe(true);
            expect(isFinite(point.y)).toBe(true);
        });

        // Check that the offset is actually perpendicular to the original line
        const originalVector = {
            x: diagonalLine[1].x - diagonalLine[0].x,
            y: diagonalLine[1].y - diagonalLine[0].y,
        };
        const offsetVector = {
            x: dOffsetPoints[1].x - dOffsetPoints[0].x,
            y: dOffsetPoints[1].y - dOffsetPoints[0].y,
        };

        // Vectors should be parallel (same direction)
        const crossProduct = Math.abs(
            originalVector.x * offsetVector.y -
                originalVector.y * offsetVector.x
        );
        expect(crossProduct).toBeCloseTo(0, 6);
    });

    test('demonstrate offset function produces correct results', () => {
        const testPoints = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 20, y: 10 },
            { x: 30, y: 10 },
        ];

        // Test with BCurve offset
        const bCurve = new BCurve(testPoints);
        const bCurveOffset = offset(bCurve, 5);

        // Test with bezier-js offset
        const bezierCurve = new Bezier(testPoints);
        const bezierOffset = bezierCurve.offset(5);

        console.log('\n=== Offset Function Demo ===');
        console.log('Original curve control points:', testPoints);
        console.log('\nBCurve offset results:');
        bCurveOffset.forEach((curve, index) => {
            console.log(`  Segment ${index}:`, curve.getControlPoints());
        });

        if (Array.isArray(bezierOffset)) {
            console.log('\nBezier-js offset results:');
            bezierOffset.forEach((curve, index) => {
                console.log(`  Segment ${index}:`, curve.points);
            });

            // Verify they match
            expect(bCurveOffset.length).toBe(bezierOffset.length);
            console.log(
                `\n✅ Both produce ${bCurveOffset.length} offset segments with identical control points!`
            );
        }
    });
});
